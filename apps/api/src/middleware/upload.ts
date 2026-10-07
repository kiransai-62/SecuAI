import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const MAX_ZIP_SIZE = 25 * 1024 * 1024; // 25MB limit

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_ZIP_SIZE,
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const isZipExt = file.originalname.toLowerCase().endsWith('.zip');
    const validMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'application/octet-stream',
      'multipart/x-zip',
    ];
    const isZipMime = validMimes.includes(file.mimetype.toLowerCase());

    if (!isZipExt && !isZipMime) {
      return cb(new Error('Invalid file type: Only .zip archive files are permitted'));
    }

    cb(null, true);
  },
});

/**
 * Middleware handling optional or required ZIP upload with clean 400 errors.
 * Accepts file under field 'file' or 'zip'.
 */
export function zipUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  const uploadHandler = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'zip', maxCount: 1 },
  ]);

  uploadHandler(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'File size exceeds maximum allowed limit of 25MB',
          });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      }
      res.status(400).json({ error: err.message || 'File upload rejected' });
      return;
    }

    // Attach single file to req.file if uploaded
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      if (files.file && files.file[0]) {
        req.file = files.file[0];
      } else if (files.zip && files.zip[0]) {
        req.file = files.zip[0];
      }
    }

    // If file is present, validate ZIP magic bytes (PK..)
    if (req.file && req.file.buffer) {
      const buf = req.file.buffer;
      const isValidMagic =
        buf.length >= 4 &&
        buf[0] === 0x50 &&
        buf[1] === 0x4b &&
        (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);

      if (!isValidMagic) {
        res.status(400).json({
          error: 'Invalid file content: Uploaded file is not a valid ZIP archive (missing PK signature)',
        });
        return;
      }
    }

    next();
  });
}
