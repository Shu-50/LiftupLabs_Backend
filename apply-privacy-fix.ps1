# Read the file
$content = Get-Content "routes/events.js" -Raw

# Define the old code to replace (exact match)
$oldCode = @"
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer.user', 'name avatar profile.institution')
            .populate('participants.user', 'name avatar');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Increment view count
        event.views += 1;
        await event.save();

        // Add user registration status if authenticated
        let isUserRegistered = false;
        if (req.user) {
            isUserRegistered = event.participants.some(
                p => p.user._id.toString() === req.user.id.toString()
            );
        }

        res.json({
            success: true,
            data: {
                event,
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
"@

# Define the new code with privacy fix
$newCode = @"
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
"@

# Replace the code
$newContent = $content.Replace($oldCode, $newCode)

# Check if replacement was made
if ($content -eq $newContent) {
    Write-Host "ERROR: No replacement was made. Pattern not found."
    exit 1
} else {
    # Write the new content back
    $newContent | Set-Content "routes/events.js" -NoNewline
    Write-Host "SUCCESS: Privacy fix applied successfully!"
}
