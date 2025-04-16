// server/services/agoraService.js
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const axios = require('axios');
const Session = require('../models/Session');

class AgoraService {
  constructor() {
    // Added fallback values for development - you'll need to replace these with your actual Agora credentials
    this.appId = process.env.AGORA_APP_ID || 'test-app-id';
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE || 'test-certificate';
    this.restApiKey = process.env.AGORA_REST_API_KEY || 'test-api-key';
    this.restApiSecret = process.env.AGORA_REST_API_SECRET || 'test-api-secret';
    this.baseUrl = 'https://api.agora.io/v1';

    // Check if Agora credentials are set
    this.isConfigured = !!process.env.AGORA_APP_ID &&
                       !!process.env.AGORA_APP_CERTIFICATE;
  }

  /**
   * Generate a token for a user to join a channel
   * @param {string} channelName - The channel name (using session ID)
   * @param {string} uid - User ID
   * @param {string} role - User role (publisher for host, subscriber for viewer)
   * @param {number} expireTime - Token expiration time in seconds
   * @returns {string} - The generated token
   */
  generateToken(channelName, uid, role = 'publisher', expireTime = 3600) {
    // Return a placeholder token if Agora isn't configured
    if (!this.isConfigured) {
      return 'placeholder-token-agora-not-configured';
    }

    // Set the privilege expire time in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    // Determine the role
    const userRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Generate the token
    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      userRole,
      privilegeExpireTime
    );

    return token;
  }

  /**
   * Create a new streaming channel
   * @param {string} sessionId - The session ID to use as channel name
   * @param {string} trainerId - The trainer's user ID
   * @returns {Object} - Channel details including tokens
   */
  async createChannel(sessionId, trainerId) {
    try {
      // We'll use the session ID as the channel name for simplicity
      const channelName = `session_${sessionId}`;

      // Generate host token for the trainer
      const hostToken = this.generateToken(channelName, trainerId, 'publisher', 24 * 3600); // 24 hours

      // Return the channel details
      return {
        channelName,
        hostToken,
        appId: this.appId
      };
    } catch (error) {
      console.error('Error creating Agora channel:', error);
      throw error;
    }
  }

  /**
   * Generate a token for a viewer to join a channel
   * @param {string} sessionId - The session ID
   * @param {string} userId - The user's ID
   * @returns {Object} - Channel details including viewer token
   */
  async generateViewerToken(sessionId, userId) {
    try {
      const channelName = `session_${sessionId}`;
      const viewerToken = this.generateToken(channelName, userId, 'subscriber', 3 * 3600); // 3 hours

      return {
        channelName,
        viewerToken,
        appId: this.appId
      };
    } catch (error) {
      console.error('Error generating viewer token:', error);
      throw error;
    }
  }

  /**
   * Update session status when streaming starts/ends
   * @param {string} sessionId - The session ID
   * @param {string} status - New status (live, completed)
   * @param {Object} streamDetails - Streaming details to store
   * @returns {Object} - Updated session
   */
  async updateSessionStreamStatus(sessionId, status, streamDetails = {}) {
    try {
      const updateData = {
        status,
        'streamingDetails.status': status
      };

      if (status === 'live') {
        updateData['streamingDetails.startedAt'] = new Date();
        updateData['streamingDetails.channelName'] = streamDetails.channelName;
        updateData['streamingDetails.resourceId'] = streamDetails.resourceId;
      } else if (status === 'completed') {
        updateData['streamingDetails.endedAt'] = new Date();
      }

      const session = await Session.findByIdAndUpdate(
        sessionId,
        { $set: updateData },
        { new: true }
      );

      return session;
    } catch (error) {
      console.error('Error updating session stream status:', error);
      throw error;
    }
  }

  /**
   * Check if Agora is properly configured
   * @returns {boolean} - Whether Agora is configured
   */
  isAgoraConfigured() {
    return this.isConfigured;
  }
}

module.exports = new AgoraService();
