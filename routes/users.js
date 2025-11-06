const express = require('express');
const { query } = require('express-validator');
const User = require('../models/User');
const Event = require('../models/Event');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', protect, authorize('admin'), [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['student', 'professional', 'institution', 'admin'])
], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.role) filter.role = req.query.role;
        if (req.query.search) {
            filter.$or = [
                { name: new RegExp(req.query.search, 'i') },
                { email: new RegExp(req.query.search, 'i') }
            ];
        }

        const users = await User.find(filter)
            .select('-password -emailVerificationToken -passwordResetToken')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(filter);

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching users'
        });
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -emailVerificationToken -passwordResetToken')
            .populate('registeredEvents.event', 'title dateTime.start location.city')
            .populate('hostedEvents', 'title dateTime.start participants');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    } catch (error) {
        console.error('Get user error:', error);
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user'
        });
    }
});

// @route   GET /api/users/stats/dashboard
// @desc    Get dashboard statistics
// @access  Private/Admin
router.get('/stats/dashboard', protect, authorize('admin'), async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalEvents = await Event.countDocuments();
        const activeEvents = await Event.countDocuments({
            status: 'published',
            'dateTime.end': { $gte: new Date() }
        });
        const totalRegistrations = await Event.aggregate([
            { $group: { _id: null, total: { $sum: '$registration.currentParticipants' } } }
        ]);

        // User role distribution
        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        // Events by category
        const eventsByCategory = await Event.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        // Recent registrations (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentRegistrations = await User.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    totalEvents,
                    activeEvents,
                    totalRegistrations: totalRegistrations[0]?.total || 0
                },
                usersByRole,
                eventsByCategory,
                recentRegistrations
            }
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard statistics'
        });
    }
});

// @route   PUT /api/users/:id/status
// @desc    Update user status (activate/deactivate)
// @access  Private/Admin
router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
    try {
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean value'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: { user }
        });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating user status'
        });
    }
});

// @route   GET /api/users/search/mentors
// @desc    Search for mentors/professionals
// @access  Private
router.get('/search/mentors', protect, [
    query('skills').optional().isString(),
    query('city').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const filter = {
            role: { $in: ['professional', 'institution'] },
            isActive: true
        };

        if (req.query.skills) {
            const skills = req.query.skills.split(',').map(s => s.trim());
            filter['profile.skills'] = { $in: skills };
        }

        if (req.query.city) {
            filter['profile.city'] = new RegExp(req.query.city, 'i');
        }

        const mentors = await User.find(filter)
            .select('name avatar profile role hostedEvents')
            .populate('hostedEvents', 'title participants')
            .limit(limit)
            .sort({ 'hostedEvents.length': -1 });

        res.json({
            success: true,
            data: { mentors }
        });
    } catch (error) {
        console.error('Search mentors error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while searching mentors'
        });
    }
});

module.exports = router;