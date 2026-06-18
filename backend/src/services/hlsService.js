import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { videoProcessingStatus } from './socketService.js';

/**
 * Converts a video file into HLS segments (.m3u8 index and .ts chunks)
 * using the static ffmpeg binary.
 * 
 * First tries stream copy (instantaneous, keeps original video/audio tracks).
 * If that fails, it falls back to full encoding (libx264/aac).
 * 
 * @param {string} inputPath - Absolute path to input video file
 * @param {string} outputDir - Absolute path to HLS output directory
 * @param {object} io - Socket.io instance for progress notifications
 * @param {string} roomId - The roomId to broadcast progress updates to
 * @param {function} onComplete - Callback when conversion completes, takes the virtual URL path
 * @param {function} onError - Callback when conversion fails
 */
export function convertToHls({ inputPath, outputDir, io, roomId, onComplete, onError }) {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const indexPlaylistName = 'index.m3u8';
  const indexPlaylistPath = path.join(outputDir, indexPlaylistName);
  const segmentFilename = path.join(outputDir, 'seg_%03d.ts');

  // Broadcast starting phase
  videoProcessingStatus.set(roomId, { status: 'started', message: 'Analyzing uploaded video file...' });
  if (io) {
    io.to(roomId).emit('video-processing', { status: 'started', message: 'Analyzing uploaded video file...' });
  }

  console.log(`🎬 Starting HLS conversion (Stream Copy) for: ${inputPath}`);

  // FFmpeg arguments for stream copy
  const streamCopyArgs = [
    '-y', // Overwrite files
    '-i', inputPath,
    '-codec', 'copy',
    '-start_number', '0',
    '-hls_time', '10',
    '-hls_list_size', '0',
    '-hls_segment_filename', segmentFilename,
    indexPlaylistPath
  ];

  videoProcessingStatus.set(roomId, { status: 'segmenting', message: 'Extracting video tracks into HLS buckets (Fast Stream Copy)...' });
  if (io) {
    io.to(roomId).emit('video-processing', { status: 'segmenting', message: 'Extracting video tracks into HLS buckets (Fast Stream Copy)...' });
  }

  const copyProcess = spawn(ffmpegPath, streamCopyArgs);
  let copyStderr = '';

  copyProcess.stderr.on('data', (data) => {
    copyStderr += data.toString();
  });

  copyProcess.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ HLS conversion completed successfully via stream copy.`);
      
      // Delete temporary input video file
      try {
        fs.unlinkSync(inputPath);
      } catch (err) {
        console.error('⚠️ Failed to delete source video file:', err);
      }

      const relativeUrl = `/uploads/${path.relative('public/uploads', indexPlaylistPath).replace(/\\/g, '/')}`;
      
      videoProcessingStatus.delete(roomId);
      if (io) {
        io.to(roomId).emit('video-processing', { status: 'completed', videoUrl: relativeUrl });
      }
      onComplete(relativeUrl);
    } else {
      console.warn(`⚠️ Stream copy failed with code ${code}. Stderr: ${copyStderr}. Falling back to full HLS transcoding...`);
      
      videoProcessingStatus.set(roomId, { status: 'segmenting', message: 'Stream copy failed. Transcoding video chunks (this might take a moment)...' });
      if (io) {
        io.to(roomId).emit('video-processing', { status: 'segmenting', message: 'Stream copy failed. Transcoding video chunks (this might take a moment)...' });
      }

      // FFmpeg arguments for full transcoding
      const transcodeArgs = [
        '-y',
        '-i', inputPath,
        '-codec:v', 'libx264',
        '-codec:a', 'aac',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-g', '60',
        '-sc_threshold', '0',
        '-hls_time', '10',
        '-hls_list_size', '0',
        '-hls_segment_filename', segmentFilename,
        indexPlaylistPath
      ];

      const transcodeProcess = spawn(ffmpegPath, transcodeArgs);
      let transcodeStderr = '';

      transcodeProcess.stderr.on('data', (data) => {
        transcodeStderr += data.toString();
      });

      transcodeProcess.on('close', (transcodeCode) => {
        // Clean up the temporary input file in all cases
        try {
          fs.unlinkSync(inputPath);
        } catch (err) {
          console.error('⚠️ Failed to delete source video file:', err);
        }

        if (transcodeCode === 0) {
          console.log(`✅ HLS conversion completed successfully via full transcoding.`);
          const relativeUrl = `/uploads/${path.relative('public/uploads', indexPlaylistPath).replace(/\\/g, '/')}`;
          
          videoProcessingStatus.delete(roomId);
          if (io) {
            io.to(roomId).emit('video-processing', { status: 'completed', videoUrl: relativeUrl });
          }
          onComplete(relativeUrl);
        } else {
          console.error(`❌ HLS transcoding failed with code ${transcodeCode}. Stderr:`, transcodeStderr);
          
          videoProcessingStatus.set(roomId, { status: 'failed', message: 'Failed to convert video file. The format is not supported.' });
          setTimeout(() => {
            if (videoProcessingStatus.get(roomId)?.status === 'failed') {
              videoProcessingStatus.delete(roomId);
            }
          }, 10000);

          if (io) {
            io.to(roomId).emit('video-processing', { status: 'failed', message: 'Failed to convert video file. The format is not supported.' });
          }
          onError(new Error(`Transcoding failed with exit code ${transcodeCode}`));
        }
      });
    }
  });
}
