// server/controllers/streamController.js
const Session = require('../models/Session');
const User = require('../models/User');
const agoraService = require('../services/agoraService');

// Get streaming details for a session
exports.getStreamingDetails = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId).populate('trainer', 'firstName lastName');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is authorized to access this stream
    const isTrainer = req.user.role === 'trainer' || req.user.role === 'admin';
    const isSessionTrainer = session.trainer._id.toString() === userId;

    // For participants, check if they've booked the session
    let hasBooked = false;
    if (!isTrainer || !isSessionTrainer) {
      const user = await User.findById(userId);
      hasBooked = user.bookedSessions.some(booking =>
        booking.session.toString() === sessionId
      );

      if (!hasBooked) {
        return res.status(403).json({ message: 'You must book this session to join' });
      }
    }

    // Check session status and timing
    const now = new Date();
    const scheduledTime = new Date(session.scheduledAt);
    const bufferMinutes = 15; // Buffer time for trainers to start early

    if (session.status === 'cancelled') {
      return res.status(400).json({ message: 'This session has been cancelled' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ message: 'This session has ended' });
    }

    // For trainer trying to get stream details
    if (isTrainer && isSessionTrainer) {
      // If session is not live yet, but within buffer time
      if (session.status === 'scheduled' &&
          (scheduledTime - now) / (1000 * 60) <= bufferMinutes) {
        return res.json({
          message: 'Session not yet started. Use start endpoint to begin streaming.',
          status: 'scheduled',
          canStart: true,
          scheduledAt: session.scheduledAt,
          sessionData: {
            title: session.title,
            trainer: `${session.trainer.firstName} ${session.trainer.lastName}`,
            duration: session.duration
          }
        });
      }

      // If session is already live
      if (session.status === 'live' && session.streamingDetails?.channelName) {
        // Generate a fresh host token
        const { channelName, hostToken, appId } = await agoraService.createChannel(
          sessionId,
          userId
        );

        return res.json({
          status: 'live',
          isHost: true,
          sessionData: {
            title: session.title,
            trainer: `${session.trainer.firstName} ${session.trainer.lastName}`,
            duration: session.duration,
            startedAt: session.streamingDetails.startedAt
          },
          streamData: {
            appId,
            channelName,
            token: hostToken,
            uid: userId
          }
        });
      }

      // If not within buffer and not live
      if (session.status === 'scheduled' &&
          (scheduledTime - now) / (1000 * 60) > bufferMinutes) {
        return res.status(400).json({
          message: `Stream can be started ${bufferMinutes} minutes before scheduled time`,
          scheduledAt: session.scheduledAt,
          canStartAt: new Date(scheduledTime.getTime() - bufferMinutes * 60000)
        });
      }
    }

    // For participants
    if (session.status === 'scheduled') {
      return res.status(400).json({
        message: 'Stream has not started yet',
        scheduledAt: session.scheduledAt,
        sessionData: {
          title: session.title,
          trainer: `${session.trainer.firstName} ${session.trainer.lastName}`,
          duration: session.duration
        }
      });
    }

    if (session.status === 'live') {
      // Generate viewer token
      const { channelName, viewerToken, appId } = await agoraService.generateViewerToken(
        sessionId,
        userId
      );

      return res.json({
        status: 'live',
        isHost: false,
        sessionData: {
          title: session.title,
          trainer: `${session.trainer.firstName} ${session.trainer.lastName}`,
          duration: session.duration,
          startedAt: session.streamingDetails.startedAt
        },
        streamData: {
          appId,
          channelName,
          token: viewerToken,
          uid: userId
        }
      });
    }

    // If none of the above conditions are met
    return res.status(400).json({
      message: 'Unable to determine stream status',
      status: session.status
    });
  } catch (error) {
    next(error);
  }
};

// Start a streaming session
exports.startStream = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId).populate('trainer', 'firstName lastName');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the trainer for this session
    if (session.trainer._id.toString() !== userId) {
      return res.status(403).json({ message: 'Only the assigned trainer can start this stream' });
    }

    // Check if session is already live
    if (session.status === 'live') {
      return res.status(400).json({ message: 'Session is already live' });
    }

    // Check if session is cancelled or completed
    if (session.status === 'cancelled' || session.status === 'completed') {
      return res.status(400).json({ message: `Cannot start a ${session.status} session` });
    }

    // Create Agora channel and get tokens
    const { channelName, hostToken, appId } = await agoraService.createChannel(
      sessionId,
      userId
    );

    // Update session status
    await agoraService.updateSessionStreamStatus(sessionId, 'live', { channelName });

    // Return stream details to trainer
    res.json({
      message: 'Stream started successfully',
      status: 'live',
      isHost: true,
      sessionData: {
        title: session.title,
        trainer: `${session.trainer.firstName} ${session.trainer.lastName}`,
        duration: session.duration
      },
      streamData: {
        appId,
        channelName,
        token: hostToken,
        uid: userId
      }
    });
  } catch (error) {
    next(error);
  }
};

// End a streaming session
exports.endStream = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the trainer for this session
    if (session.trainer.toString() !== userId) {
      return res.status(403).json({ message: 'Only the assigned trainer can end this stream' });
    }

    // Check if session is live
    if (session.status !== 'live') {
      return res.status(400).json({ message: 'Session is not currently live' });
    }

    // Stop recording if it was started
    if (session.streamingDetails.resourceId && session.streamingDetails.sid) {
      await agoraService.stopRecording(
        session.streamingDetails.channelName,
        session.streamingDetails.sid,
        session.streamingDetails.resourceId
      );
    }

    // Update session status
    await agoraService.updateSessionStreamStatus(sessionId, 'completed');

    res.json({
      message: 'Stream ended successfully',
      status: 'completed'
    });
  } catch (error) {
    next(error);
  }
};

// Join a streaming session
exports.joinStream = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if session is live
    if (session.status !== 'live') {
      return res.status(400).json({ message: 'Session is not currently live' });
    }

    // Check if user is authorized (either trainer or has booked the session)
    const isTrainer = session.trainer.toString() === userId;

    if (!isTrainer) {
      const user = await User.findById(userId);
      const hasBooked = user.bookedSessions.some(
        booking => booking.session.toString() === sessionId
      );

      if (!hasBooked) {
        return res.status(403).json({ message: 'You must book this session to join' });
      }
    }

    // Track participant joining
    if (!isTrainer) {
      // Check if user is already in participants
      const alreadyJoined = session.participants.some(p =>
        p.user.toString() === userId
      );

      if (!alreadyJoined) {
        session.participants.push({
          user: userId,
          joinedAt: new Date()
        });
        await session.save();
      }
    }

    // Generate token based on role
    let streamDetails;
    if (isTrainer) {
      streamDetails = await agoraService.createChannel(sessionId, userId);
    } else {
      streamDetails = await agoraService.generateViewerToken(sessionId, userId);
    }

    res.json({
      message: 'Joined stream successfully',
      isHost: isTrainer,
      streamData: {
        appId: streamDetails.appId,
        channelName: streamDetails.channelName,
        token: isTrainer ? streamDetails.hostToken : streamDetails.viewerToken,
        uid: userId
      }
    });
  } catch (error) {
    next(error);
  }
};

// Leave a streaming session
exports.leaveStream = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // For analytics purposes, we could track when users leave
    // But we don't remove them from participants list to keep the record

    res.json({
      message: 'Left stream successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get active participants in a stream
exports.getStreamParticipants = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId)
      .populate('participants.user', 'firstName lastName profilePicture');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the trainer or an admin
    const isTrainerOrAdmin =
      req.user.role === 'trainer' ||
      req.user.role === 'admin' ||
      session.trainer.toString() === userId;

    if (!isTrainerOrAdmin) {
      return res.status(403).json({ message: 'Not authorized to view participant details' });
    }

    // If session has a channel name, get active participants from Agora
    let activeUsers = [];
    if (session.streamingDetails?.channelName) {
      try {
        activeUsers = await agoraService.getChannelUsers(session.streamingDetails.channelName);
      } catch (error) {
        console.error('Error fetching active users from Agora:', error);
        // Continue with participant list from database even if Agora API fails
      }
    }

    // Map participants data
    const participants = session.participants.map(participant => {
      const user = participant.user;
      return {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        profilePicture: user.profilePicture,
        joinedAt: participant.joinedAt,
        // Check if user is currently active in the stream
        active: activeUsers.some(activeUser => activeUser.uid.toString() === user._id.toString())
      };
    });

    res.json({
      participants,
      totalCount: participants.length,
      activeCount: participants.filter(p => p.active).length
    });
  } catch (error) {
    next(error);
  }
};

// Add to controllers/streamController.js

// Get active participants in a stream
exports.getStreamParticipants = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists
    const session = await Session.findById(sessionId)
      .populate('participants.user', 'firstName lastName email profilePicture');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is the trainer or an admin
    const isTrainerOrAdmin =
      req.user.role === 'trainer' ||
      req.user.role === 'admin' ||
      session.trainer.toString() === req.user.id;

    if (!isTrainerOrAdmin) {
      return res.status(403).json({ message: 'Not authorized to view participant details' });
    }

    // Get current timestamp for determining active status
    const now = new Date();
    // If a user joined and hasn't left within the last 2 minutes, consider them active
    const activeThreshold = new Date(now.getTime() - 2 * 60 * 1000);

    // Format participants for response
    const participants = session.participants
      .filter(p => p.joinedAt) // Only include participants who have joined
      .map(participant => {
        const user = participant.user;

        // Calculate if participant is active (has joined and hasn't left recently)
        let isActive = false;
        if (participant.joinedAt) {
          if (!participant.leaveAt) {
            isActive = true;
          } else {
            // If they rejoined after leaving, check last join time
            const lastJoinTime = new Date(participant.joinedAt);
            isActive = lastJoinTime > participant.leaveAt;
          }
        }

        return {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          profilePicture: user.profilePicture,
          joinedAt: participant.joinedAt,
          active: isActive,
          // Include additional fields that might be useful
          duration: participant.duration || 0
        };
      });

    res.json({
      participants,
      totalCount: participants.length,
      activeCount: participants.filter(p => p.active).length
    });
  } catch (error) {
    next(error);
  }
};

// Add to controllers/streamController.js

// Send a message in a stream
exports.sendMessage = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Check if session exists and is live
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status !== 'live') {
      return res.status(400).json({ message: 'Session is not currently live' });
    }

    // Add the message to the session
    session.addMessage(req.user.id, message);
    await session.save();

    // Return the message details
    res.status(201).json({
      id: session.messages[session.messages.length - 1]._id,
      user: {
        _id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      message,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
};

// Send a reaction in a stream
exports.sendReaction = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { type } = req.body;

    if (!type || !['thumbsUp', 'heart', 'star', 'clap', 'fire'].includes(type)) {
      return res.status(400).json({ message: 'Valid reaction type is required' });
    }

    // Check if session exists and is live
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status !== 'live') {
      return res.status(400).json({ message: 'Session is not currently live' });
    }

    // Add the reaction to the session
    session.addReaction(req.user.id, type);
    await session.save();

    // Return the reaction details
    res.status(201).json({
      id: session.reactions[session.reactions.length - 1]._id,
      user: {
        _id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      type,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
};

// Record user joining a session
exports.joinStream = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if session is live
    if (session.status !== 'live') {
      return res.status(400).json({ message: 'Session is not currently live' });
    }

    // Record the participant joining
    session.recordParticipantJoin(userId);
    await session.save();

    // Generate viewer token for the user
    let streamData = {};
    if (session.streamingDetails && session.streamingDetails.channelName) {
      // Get Agora service
      const agoraService = require('../services/agoraService');

      // Check if Agora is configured
      if (agoraService.isAgoraConfigured()) {
        // Generate token
        streamData = await agoraService.generateViewerToken(sessionId, userId);
      } else {
        // Return placeholder for development
        streamData = {
          appId: 'dev-app-id',
          channelName: session.streamingDetails.channelName,
          viewerToken: 'dev-token-agora-not-configured',
          uid: userId
        };
      }
    }

    res.json({
      message: 'Joined stream successfully',
      streamData
    });
  } catch (error) {
    next(error);
  }
};

// Record user leaving a session
exports.leaveStream = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Record the participant leaving
    session.recordParticipantLeave(userId);
    await session.save();

    res.json({
      message: 'Left stream successfully'
    });
  } catch (error) {
    next(error);
  }
};
