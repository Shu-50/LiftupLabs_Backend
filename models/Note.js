const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        minlength: [5, 'Title must be at least 5 characters'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Type is required'],
        enum: {
            values: ['Notes', 'PYQ', 'Cheatsheet', 'Lab Manual', 'Slides'],
            message: '{VALUE} is not a valid note type'
        }
    },
    semester: {
        type: String,
        trim: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Author is required']
    },
    university: {
        type: String,
        trim: true
    },
    fileUrl: {
        type: String,
        required: [true, 'File URL is required']
    },
    fileName: {
        type: String,
        required: [true, 'File name is required']
    },
    fileSize: {
        type: Number,
        required: [true, 'File size is required']
    },
    pages: {
        type: Number,
        default: 0
    },
    downloads: {
        type: Number,
        default: 0,
        min: 0
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    ratingCount: {
        type: Number,
        default: 0,
        min: 0
    },
    tags: [{
        type: String,
        trim: true
    }],
    savedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    ratings: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for better query performance
noteSchema.index({ subject: 1 });
noteSchema.index({ type: 1 });
noteSchema.index({ semester: 1 });
noteSchema.index({ downloads: -1 });
noteSchema.index({ rating: -1 });
noteSchema.index({ createdAt: -1 });
noteSchema.index({ author: 1 });
noteSchema.index({ isActive: 1 });
noteSchema.index({ title: 'text', description: 'text', tags: 'text' }); // Text search

// Virtual for checking if user has saved this note
noteSchema.methods.isSavedByUser = function (userId) {
    return this.savedBy.some(id => id.toString() === userId.toString());
};

// Virtual for checking if user has rated this note
noteSchema.methods.hasUserRated = function (userId) {
    return this.ratings.some(r => r.user.toString() === userId.toString());
};

// Method to calculate average rating
noteSchema.methods.calculateRating = function () {
    if (this.ratings.length === 0) {
        this.rating = 0;
        this.ratingCount = 0;
    } else {
        const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
        this.rating = Math.round((sum / this.ratings.length) * 10) / 10; // Round to 1 decimal
        this.ratingCount = this.ratings.length;
    }
};

// Get public note data
noteSchema.methods.getPublicData = function () {
    const noteObject = this.toObject();
    return noteObject;
};

// Pre-save hook to update rating
noteSchema.pre('save', function (next) {
    if (this.isModified('ratings')) {
        this.calculateRating();
    }
    next();
});

module.exports = mongoose.model('Note', noteSchema);
