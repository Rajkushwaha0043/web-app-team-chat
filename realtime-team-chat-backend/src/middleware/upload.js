const multer = require('multer');
const path = require('path');
const createError = require('http-errors');

// Set storage engine - using memory storage for multer v2
const storage = multer.memoryStorage();

// Check file type
const fileFilter = (req, file, cb) => {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp3|wav/;
    
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    // Check mime type
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(createError(400, 'Error: File type not supported!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
});

// Specific upload handlers
const uploadAvatar = upload.single('avatar');
const uploadFile = upload.single('file');
const uploadMultiple = upload.array('files', 5); // Max 5 files

module.exports = {
    uploadAvatar,
    uploadFile,
    uploadMultiple
};