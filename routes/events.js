const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Event = require('../models/Event');
const User = require('../models/User');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/events
// @desc    Get all events with filtering and pagination
// @access  Public
router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('category').optional().isIn(['hackathon', 'quiz', 'workshop', 'seminar', 'tech-fest', 'competition', 'conference']),
    query('mode').optional().isIn(['Online', 'Offline', 'Hybrid']),
    query('city').optional().isString(),
    query('sort').optional().isIn(['latest', 'oldest', 'prize', 'deadline', 'participants'])
], optionalAuth, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Invalid query parameters:', errors.array());
            console.error('Request query:', req.query);
            return res.status(400).json({
                success: false,
                message: 'Invalid query parameters',
                errors: errors.array()
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = { status: 'published' };

        if (req.query.category) filter.category = req.query.category;
        if (req.query.mode) filter.mode = req.query.mode;
        if (req.query.city) filter['location.city'] = new RegExp(req.query.city, 'i');
        if (req.query.search) {
            filter.$or = [
                { title: new RegExp(req.query.search, 'i') },
                { description: new RegExp(req.query.search, 'i') },
                { tags: new RegExp(req.query.search, 'i') }
            ];
        }

        // Date filters
        if (req.query.dateFrom || req.query.dateTo) {
            filter['dateTime.start'] = {};
            if (req.query.dateFrom) filter['dateTime.start'].$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) filter['dateTime.start'].$lte = new Date(req.query.dateTo);
        }

        // Prize filter
        if (req.query.minPrize) {
            filter['prizes.0.amount'] = { $gte: parseInt(req.query.minPrize) };
        }

        // Build sort object
        let sort = { createdAt: -1 }; // Default sort
        switch (req.query.sort) {
            case 'latest':
                sort = { 'dateTime.start': -1 };
                break;
            case 'oldest':
                sort = { 'dateTime.start': 1 };
                break;
            case 'prize':
                sort = { 'prizes.0.amount': -1 };
                break;
            case 'deadline':
                sort = { 'registration.deadline': 1 };
                break;
            case 'participants':
                sort = { 'registration.currentParticipants': -1 };
                break;
        }

        // Execute query
        const events = await Event.find(filter)
            .populate('organizer.user', 'name avatar')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count for pagination
        const total = await Event.countDocuments(filter);

        // Add user registration status if authenticated
        if (req.user) {
            events.forEach(event => {
                event.isUserRegistered = event.participants.some(
                    p => p.user.toString() === req.user.id.toString()
                );
            });
        }

        res.json({
            success: true,
            data: {
                events,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total,
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching events'
        });
    }
});

// @route   GET /api/events/my/hosted
// @desc    Get events hosted by current user
// @access  Private
router.get('/my/hosted', protect, async (req, res) => {
    try {
        const events = await Event.find({ 'organizer.user': req.user.id })
            .sort({ createdAt: -1 })
            .populate('participants.user', 'name email');

        res.json({
            success: true,
            data: { events }
        });
    } catch (error) {
        console.error('Get hosted events error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching hosted events'
        });
    }
});

// @route   GET /api/events/my/registered
// @desc    Get events registered by current user
// @access  Private
router.get('/my/registered', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate({
                path: 'registeredEvents.event',
                populate: {
                    path: 'organizer.user',
                    select: 'name avatar'
                }
            });

        res.json({
            success: true,
            data: {
                registeredEvents: user.registeredEvents
            }
        });
    } catch (error) {
        console.error('Get registered events error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching registered events'
        });
    }
});

// @route   GET /api/events/:id
// @desc    Get single event by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer.user', 'name avatar profile.institution');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Increment view count
        event.views += 1;
        await event.save();

        // Check if user is organizer or admin
        const isOrganizer = req.user && event.organizer.user._id.toString() === req.user.id.toString();
        const isAdmin = req.user && req.user.role === 'admin';

        // Add user registration status if authenticated
        let isUserRegistered = false;
        if (req.user) {
            isUserRegistered = event.participants.some(
                p => p.user.toString() === req.user.id.toString()
            );
        }

        // Convert to plain object
        const eventObj = event.toObject();

        // Privacy protection: Only organizers and admins can see participant details
        if (!isOrganizer && !isAdmin) {
            // Regular users only see the count, not the participant list
            eventObj.participantCount = eventObj.participants.length;
            delete eventObj.participants;
        } else {
            // Organizers and admins see full participant details
            await event.populate('participants.user', 'name email avatar profile');
            eventObj.participants = event.participants;
        }

        res.json({
            success: true,
            data: {
                event: eventObj,
                isUserRegistered
            }
        });
    } catch (error) {
        console.error('Get event error:', error);
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error while fetching event'
        });
    }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Private
router.post('/', protect, [
    body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
    body('description').trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20 and 2000 characters'),
    body('category').isIn(['hackathon', 'quiz', 'workshop', 'seminar', 'tech-fest', 'competition', 'conference']).withMessage('Invalid category'),
    body('mode').isIn(['Online', 'Offline', 'Hybrid']).withMessage('Invalid mode'),
    body('dateTime.start').isISO8601().withMessage('Invalid start date format'),
    body('dateTime.end').isISO8601().withMessage('Invalid end date format'),
    body('registration.deadline').isISO8601().withMessage('Invalid registration deadline format'),
    body('location.city').if(body('mode').equals('Offline')).notEmpty().withMessage('City is required for offline events'),
    body('location.venue').if(body('mode').equals('Offline')).notEmpty().withMessage('Venue is required for offline events')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Event validation errors:', errors.array());
            console.error('Request body:', JSON.stringify(req.body, null, 2));
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Validate dates
        const startDate = new Date(req.body.dateTime.start);
        const endDate = new Date(req.body.dateTime.end);
        const deadline = new Date(req.body.registration.deadline);
        const now = new Date();

        if (startDate <= now) {
            return res.status(400).json({
                success: false,
                message: 'Event start date must be in the future'
            });
        }

        if (endDate <= startDate) {
            return res.status(400).json({
                success: false,
                message: 'Event end date must be after start date'
            });
        }

        if (deadline >= startDate) {
            return res.status(400).json({
                success: false,
                message: 'Registration deadline must be before event start date'
            });
        }

        // Create event
        const eventData = {
            ...req.body,
            organizer: {
                user: req.user.id,
                name: req.user.name,
                institution: req.user.profile?.institution,
                contact: {
                    email: req.body.contactEmail || req.user.email,
                    phone: req.body.contactPhone,
                    website: req.body.website,
                    socialMedia: {
                        linkedin: req.body.organizerLinkedin,
                        twitter: req.body.organizerTwitter,
                        instagram: req.body.organizerInstagram
                    }
                }
            },
            type: req.body.category.charAt(0).toUpperCase() + req.body.category.slice(1)
        };

        const event = await Event.create(eventData);

        // Add event to user's hosted events
        await User.findByIdAndUpdate(req.user.id, {
            $push: { hostedEvents: event._id }
        });

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: { event }
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating event'
        });
    }
});

// @route   PUT /api/events/:id
// @desc    Update an event
// @access  Private (Only event organizer)
router.put('/:id', protect, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if user is the organizer
        if (event.organizer.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only event organizer can update this event.'
            });
        }

        // Update event
        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Event updated successfully',
            data: { event: updatedEvent }
        });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating event'
        });
    }
});

// @route   DELETE /api/events/:id
// @desc    Delete an event
// @access  Private (Only event organizer or admin)
router.delete('/:id', protect, async (req, res) => {
    try {
        console.log('Delete request received for event ID:', req.params.id);
        console.log('User ID:', req.user.id);

        const event = await Event.findById(req.params.id);

        if (!event) {
            console.log('Event not found');
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        console.log('Event organizer ID:', event.organizer.user.toString());
        console.log('User role:', req.user.role);

        // Check if user is the organizer or admin
        if (event.organizer.user.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
            console.log('Access denied - user is not organizer or admin');
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only event organizer or admin can delete this event.'
            });
        }

        console.log('Deleting event...');
        await Event.findByIdAndDelete(req.params.id);

        // Remove event from user's hosted events
        console.log('Removing event from user hosted events...');
        await User.findByIdAndUpdate(event.organizer.user, {
            $pull: { hostedEvents: event._id }
        });

        console.log('Event deleted successfully');
        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting event'
        });
    }
});

// @route   POST /api/events/:id/register
// @desc    Register for an event
// @access  Private
router.post('/:id/register', protect, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if user can register
        const canRegister = event.canUserRegister(req.user.id);
        if (!canRegister.canRegister) {
            return res.status(400).json({
                success: false,
                message: canRegister.reason
            });
        }

        // Register user
        await event.registerUser(req.user.id, req.body);

        // Add event to user's registered events
        await User.findByIdAndUpdate(req.user.id, {
            $push: {
                registeredEvents: {
                    event: event._id,
                    status: 'registered'
                }
            }
        });

        res.json({
            success: true,
            message: 'Successfully registered for the event',
            data: {
                eventId: event._id,
                eventTitle: event.title
            }
        });
    } catch (error) {
        console.error('Event registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while registering for event'
        });
    }
});

// @route   DELETE /api/events/:id/register
// @desc    Unregister from an event
// @access  Private
router.delete('/:id/register', protect, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if user is registered
        const isRegistered = event.participants.some(p => p.user.toString() === req.user.id.toString());
        if (!isRegistered) {
            return res.status(400).json({
                success: false,
                message: 'You are not registered for this event'
            });
        }

        // Unregister user
        await event.unregisterUser(req.user.id);

        // Remove event from user's registered events
        await User.findByIdAndUpdate(req.user.id, {
            $pull: {
                registeredEvents: { event: event._id }
            }
        });

        res.json({
            success: true,
            message: 'Successfully unregistered from the event'
        });
    } catch (error) {
        console.error('Event unregistration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while unregistering from event'
        });
    }
});

// @route   POST /api/events/:id/admin-register
// @desc    Register a user for an event (admin only)
// @access  Private/Admin
router.post('/:id/admin-register', protect, authorize('admin'), async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is already registered
        const isAlreadyRegistered = event.participants.some(p => p.user.toString() === userId);
        if (isAlreadyRegistered) {
            return res.status(400).json({
                success: false,
                message: 'User is already registered for this event'
            });
        }

        // Register user
        await event.registerUser(userId);

        // Add event to user's registered events
        await User.findByIdAndUpdate(userId, {
            $push: {
                registeredEvents: {
                    event: event._id,
                    status: 'confirmed' // Admin registrations are automatically confirmed
                }
            }
        });

        res.json({
            success: true,
            message: 'User registered for event successfully',
            data: {
                eventId: event._id,
                userId: userId
            }
        });
    } catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while registering user for event'
        });
    }
});

// @route   PUT /api/events/:id/participants/:participantId/status
// @desc    Update participant status (event organizer only)
// @access  Private
router.put('/:id/participants/:participantId/status', protect, async (req, res) => {
    try {
        const { status } = req.body;
        const { id: eventId, participantId } = req.params;

        if (!['registered', 'confirmed', 'attended', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: registered, confirmed, attended, cancelled'
            });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if user is the organizer
        if (event.organizer.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only event organizer can update participant status.'
            });
        }

        // Find and update participant
        const participant = event.participants.id(participantId);
        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found'
            });
        }

        participant.status = status;
        await event.save();

        // Also update in user's registered events
        await User.updateOne(
            {
                _id: participant.user,
                'registeredEvents.event': eventId
            },
            {
                $set: { 'registeredEvents.$.status': status }
            }
        );

        res.json({
            success: true,
            message: 'Participant status updated successfully',
            data: { participant }
        });
    } catch (error) {
        console.error('Update participant status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating participant status'
        });
    }
});

// @route   GET /api/events/:id/participants
// @desc    Get event participants (event organizer only)
// @access  Private
router.get('/:id/participants', protect, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('participants.user', 'name email avatar profile');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if user is the organizer
        if (event.organizer.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only event organizer can view participants.'
            });
        }

        res.json({
            success: true,
            data: {
                participants: event.participants,
                totalParticipants: event.participants.length,
                maxParticipants: event.registration.maxParticipants
            }
        });
    } catch (error) {
        console.error('Get participants error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching participants'
        });
    }
});

// @route   GET /api/events/:id/analytics
// @desc    Get event analytics (event organizer only)
// @access  Private
router.get('/:id/analytics', protect, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('participants.user', 'name email');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Check if user is the organizer
        if (event.organizer.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only event organizer can view analytics.'
            });
        }

        // Calculate analytics
        const participants = event.participants;
        const statusCounts = {
            registered: 0,
            confirmed: 0,
            attended: 0,
            cancelled: 0
        };

        const dailyRegistrations = {};

        participants.forEach(participant => {
            // Count by status
            statusCounts[participant.status] = (statusCounts[participant.status] || 0) + 1;

            // Count by registration date
            const regDate = new Date(participant.registeredAt).toDateString();
            dailyRegistrations[regDate] = (dailyRegistrations[regDate] || 0) + 1;
        });

        // Calculate registration trend (last 7 days)
        const last7Days = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            last7Days.push({
                date: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                count: dailyRegistrations[dateStr] || 0
            });
        }

        const analytics = {
            totalRegistrations: participants.length,
            confirmedParticipants: statusCounts.confirmed,
            attendedParticipants: statusCounts.attended,
            cancelledRegistrations: statusCounts.cancelled,
            registrationTrend: last7Days,
            statusDistribution: statusCounts,
            dailyRegistrations,
            views: event.views || 0,
            revenue: (event.registration?.fee || 0) * participants.length,
            capacityUtilization: event.registration?.maxParticipants ?
                (participants.length / event.registration.maxParticipants) * 100 : null
        };

        res.json({
            success: true,
            data: { analytics }
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching analytics'
        });
    }
});

module.exports = router;