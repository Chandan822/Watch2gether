import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * Multer File Upload Middleware
 *
 * Configures file stream handling for avatar image uploads:
 * 1. Storage destination: writes directly to './public/uploads/'.
 * 2. Filename formatting: prefix naming utilizing active user ID and timestamp.
 * 3. Constraints: enforces 2MB size ceiling and filter-limits type formats.
 */

const UPLOAD_DIR = './public/uploads';

// Dynamically compile directories if missing on launch
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configures disk storage paths
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Read user details from requireAuth context
    const userId = req.user ? req.user.id : 'unauth';
    const extension = path.extname(file.originalname).toLowerCase();

    cb(null, `avatar-${userId}-${Date.now()}${extension}`);
  },
});

// Enforce image-only MIME formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error('Format error: Only JPEG, PNG, and WEBP images are supported'),
      false
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB size ceiling limit
  },
  fileFilter,
});

// Configures disk storage paths for PDFs
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const roomId = req.params.id || 'noroom';
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `pdf-${roomId}-${Date.now()}${extension}`);
  },
});

// Enforce PDF-only MIME format
const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Format error: Only PDF documents are supported'), false);
  }
};

export const uploadPdf = multer({
  storage: pdfStorage,
  limits: {
    fileSize: 10 * 1024 * 1025, // 10MB size ceiling limit
  },
  fileFilter: pdfFileFilter,
});

// Configures disk storage paths for Videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const roomId = req.params.id || 'noroom';
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `video-${roomId}-${Date.now()}${extension}`);
  },
});

// Enforce Video MIME format
const videoFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-matroska',
    'video/mpeg',
    'video/3gpp',
  ];
  const fileExt = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    '.mp4',
    '.webm',
    '.ogg',
    '.mov',
    '.mkv',
    '.avi',
    '.3gp',
  ];

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    allowedExtensions.includes(fileExt)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Format error: Only video files (MP4, WEBM, OGG, MOV, MKV, AVI, 3GP) are supported'
      ),
      false
    );
  }
};

export const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB size ceiling limit
  },
  fileFilter: videoFileFilter,
});

export default upload;
