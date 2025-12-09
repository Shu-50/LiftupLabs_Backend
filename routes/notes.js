const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, query, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Configure Multer for temporary file uploads
const upload = multer({
    storage: multer.memoryStorage(), // Store in memory for Supabase upload
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit (Supabase free tier)
    }
});

// @route   GET /api/notes
// @desc    Get all notes with filters, sorting, and pagination
// @access  Public
router.get('/', [
    query('search').optional().isString(),
    query('subject').optional().isString(),
    query('type').optional().isIn(['Notes', 'PYQ', 'Cheatsheet', 'Lab Manual', 'Slides']),
    query('semester').optional().isString(),
    query('sort').optional().isIn(['latest', 'oldest', 'downloads', 'rating']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
], optionalAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid query parameters',
                errors: errors.array()
            });
        }

        // Build query
        let query = supabase
            .from('notes')
            .select('*', { count: 'exact' })
            .eq('is_active', true);

        // Search filter
        if (req.query.search) {
            query = query.or(`title.ilike.%${req.query.search}%,description.ilike.%${req.query.search}%`);
        }

        // Subject filter
        if (req.query.subject && req.query.subject !== 'All' && req.query.subject !== 'All Subjects') {
            query = query.eq('subject', req.query.subject);
        }

        // Type filter
        if (req.query.type && req.query.type !== 'All' && req.query.type !== 'All Types') {
            query = query.eq('type', req.query.type);
        }

        // Semester filter
        if (req.query.semester && req.query.semester !== 'All' && req.query.semester !== 'All Semesters') {
            query = query.eq('semester', req.query.semester);
        }

        // Sorting
        switch (req.query.sort) {
            case 'oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'downloads':
                query = query.order('downloads', { ascending: false });
                break;
            case 'rating':
                query = query.order('rating', { ascending: false });
                break;
            case 'latest':
            default:
                query = query.order('created_at', { ascending: false });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.range(from, to);

        const { data: notes, error, count } = await query;

        if (error) throw error;

        // Add user-specific data if authenticated
        if (req.user && notes) {
            notes.forEach(note => {
                note.isSaved = note.saved_by && note.saved_by.includes(req.user.id);
                // Get user's rating if exists
                if (note.ratings) {
                    const userRating = note.ratings.find(r => r.user_id === req.user.id);
                    note.userRating = userRating ? userRating.rating : null;
                }
            });
        }

        const totalPages = Math.ceil(count / limit);

        res.json({
            success: true,
            data: {
                notes: notes || [],
                pagination: {
                    current: page,
                    pages: totalPages,
                    total: count,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching notes'
        });
    }
});

// @route   GET /api/notes/my/saved
// @desc    Get user's saved notes
// @access  Private
router.get('/my/saved', protect, async (req, res) => {
    try {
        const { data: notes, error } = await supabase
            .from('notes')
            .select('*')
            .contains('saved_by', [req.user.id])
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        notes.forEach(note => {
            note.isSaved = true;
        });

        res.json({
            success: true,
            data: { notes: notes || [] }
        });
    } catch (error) {
        console.error('Get saved notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching saved notes'
        });
    }
});

// @route   GET /api/notes/my/uploaded
// @desc    Get user's uploaded notes
// @access  Private
router.get('/my/uploaded', protect, async (req, res) => {
    try {
        const { data: notes, error } = await supabase
            .from('notes')
            .select('*')
            .eq('author_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: { notes: notes || [] }
        });
    } catch (error) {
        console.error('Get uploaded notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching uploaded notes'
        });
    }
});

// @route   GET /api/notes/:id
// @desc    Get single note by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { data: note, error } = await supabase
            .from('notes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        if (!note.is_active) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Add user-specific data if authenticated
        if (req.user) {
            note.isSaved = note.saved_by && note.saved_by.includes(req.user.id);
        }

        res.json({
            success: true,
            data: { note }
        });
    } catch (error) {
        console.error('Get note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching note'
        });
    }
});

// @route   POST /api/notes
// @desc    Upload a new note
// @access  Private
router.post('/', protect, upload.single('file'), [
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('type').isIn(['Notes', 'PYQ', 'Cheatsheet', 'Lab Manual', 'Slides']).withMessage('Invalid note type'),
    body('semester').optional().trim(),
    body('university').optional().trim(),
    body('tags').optional(),
    body('pages').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        console.log('Upload request received');
        console.log('Body:', req.body);
        console.log('File:', req.file ? 'Present' : 'Missing');

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'PDF file is required'
            });
        }

        // Upload file to Supabase Storage using service role key (bypasses RLS)
        const { createClient } = require('@supabase/supabase-js');
        const adminClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
        );

        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
        const filePath = `${req.user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await adminClient.storage
            .from('notes-files')
            .upload(filePath, req.file.buffer, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (uploadError) {
            console.error('File upload error:', uploadError);
            return res.status(500).json({
                success: false,
                message: 'Failed to upload file'
            });
        }

        // Get public URL
        const { data: { publicUrl } } = adminClient.storage
            .from('notes-files')
            .getPublicUrl(filePath);

        // Parse tags if provided
        let tags = [];
        if (req.body.tags) {
            try {
                tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
            } catch (e) {
                tags = [];
            }
        }

        // Create note in database
        const noteData = {
            title: req.body.title,
            description: req.body.description || null,
            subject: req.body.subject,
            type: req.body.type,
            semester: req.body.semester || null,
            author_id: req.user.id,
            author_name: req.user.name,
            author_email: req.user.email,
            university: req.body.university || null,
            file_url: publicUrl,
            file_name: req.file.originalname,
            file_size: req.file.size,
            pages: parseInt(req.body.pages) || 0,
            tags: tags
        };

        const { data: note, error: dbError } = await supabase
            .from('notes')
            .insert([noteData])
            .select()
            .single();

        if (dbError) {
            // Delete uploaded file if database insert fails
            await supabase.storage.from('notes-files').remove([filePath]);
            throw dbError;
        }

        res.status(201).json({
            success: true,
            message: 'Note uploaded successfully',
            data: { note }
        });
    } catch (error) {
        console.error('Upload note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while uploading note'
        });
    }
});

// @route   PUT /api/notes/:id
// @desc    Update note metadata
// @access  Private (Author only)
router.put('/:id', protect, [
    body('title').optional().trim().isLength({ min: 5, max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('subject').optional().trim(),
    body('type').optional().isIn(['Notes', 'PYQ', 'Cheatsheet', 'Lab Manual', 'Slides']),
    body('semester').optional().trim(),
    body('university').optional().trim(),
    body('tags').optional(),
    body('pages').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Check if note exists and user is author
        const { data: existingNote, error: fetchError } = await supabase
            .from('notes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (fetchError || !existingNote) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        if (existingNote.author_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this note'
            });
        }

        // Build update object
        const updateData = {};
        const allowedFields = ['title', 'description', 'subject', 'type', 'semester', 'university', 'pages'];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (req.body.tags) {
            updateData.tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
        }

        const { data: note, error: updateError } = await supabase
            .from('notes')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Note updated successfully',
            data: { note }
        });
    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating note'
        });
    }
});

// @route   DELETE /api/notes/:id
// @desc    Delete a note
// @access  Private (Author only)
router.delete('/:id', protect, async (req, res) => {
    try {
        const { data: note, error: fetchError } = await supabase
            .from('notes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (fetchError || !note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        if (note.author_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this note'
            });
        }

        // Soft delete
        const { error: updateError } = await supabase
            .from('notes')
            .update({ is_active: false })
            .eq('id', req.params.id);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting note'
        });
    }
});

// @route   POST /api/notes/:id/download
// @desc    Track download and return file URL
// @access  Public
router.post('/:id/download', async (req, res) => {
    try {
        const { data: note, error } = await supabase
            .from('notes')
            .select('*')
            .eq('id', req.params.id)
            .eq('is_active', true)
            .single();

        if (error || !note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Increment download count
        await supabase
            .from('notes')
            .update({ downloads: note.downloads + 1 })
            .eq('id', req.params.id);

        res.json({
            success: true,
            data: {
                fileUrl: note.file_url,
                fileName: note.file_name
            }
        });
    } catch (error) {
        console.error('Download note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while processing download'
        });
    }
});

// @route   POST /api/notes/:id/save
// @desc    Bookmark a note
// @access  Private
router.post('/:id/save', protect, async (req, res) => {
    try {
        const { data: note, error } = await supabase
            .from('notes')
            .select('saved_by')
            .eq('id', req.params.id)
            .eq('is_active', true)
            .single();

        if (error || !note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const savedBy = note.saved_by || [];
        if (savedBy.includes(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: 'Note already saved'
            });
        }

        savedBy.push(req.user.id);

        const { error: updateError } = await supabase
            .from('notes')
            .update({ saved_by: savedBy })
            .eq('id', req.params.id);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Note saved successfully'
        });
    } catch (error) {
        console.error('Save note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while saving note'
        });
    }
});

// @route   DELETE /api/notes/:id/save
// @desc    Remove bookmark from a note
// @access  Private
router.delete('/:id/save', protect, async (req, res) => {
    try {
        const { data: note, error } = await supabase
            .from('notes')
            .select('saved_by')
            .eq('id', req.params.id)
            .single();

        if (error || !note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const savedBy = (note.saved_by || []).filter(id => id !== req.user.id);

        const { error: updateError } = await supabase
            .from('notes')
            .update({ saved_by: savedBy })
            .eq('id', req.params.id);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Note removed from saved'
        });
    } catch (error) {
        console.error('Unsave note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while removing saved note'
        });
    }
});

// @route   POST /api/notes/:id/rate
// @desc    Rate a note
// @access  Private
router.post('/:id/rate', protect, [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Check if note exists
        const { data: note, error: noteError } = await supabase
            .from('notes')
            .select('id')
            .eq('id', req.params.id)
            .eq('is_active', true)
            .single();

        if (noteError || !note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Upsert rating
        const { error: ratingError } = await supabase
            .from('note_ratings')
            .upsert({
                note_id: req.params.id,
                user_id: req.user.id,
                rating: req.body.rating
            }, {
                onConflict: 'note_id,user_id'
            });

        if (ratingError) throw ratingError;

        // Recalculate average rating
        const { data: ratings, error: fetchError } = await supabase
            .from('note_ratings')
            .select('rating')
            .eq('note_id', req.params.id);

        if (!fetchError && ratings) {
            const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

            await supabase
                .from('notes')
                .update({
                    rating: Math.round(avgRating * 10) / 10,
                    rating_count: ratings.length
                })
                .eq('id', req.params.id);
        }

        res.json({
            success: true,
            message: 'Rating submitted successfully'
        });
    } catch (error) {
        console.error('Rate note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while rating note'
        });
    }
});

module.exports = router;
