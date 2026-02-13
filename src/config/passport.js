import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { setGoogleOAuthConfigured } from '../routes/auth.routes.js';
import logger from '../utils/logger.js';

/**
 * Configure Passport.js strategies.
 * Google OAuth is only enabled when credentials are present in env.
 * No sessions — we use JWT tokens, not server-side sessions.
 */
export function configurePassport() {
  // No-op serializers (defensive — some Passport plugins call these)
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

  if (!clientID || !clientSecret) {
    logger.warn(
      'Google OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET'
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      (_accessToken, _refreshToken, profile, done) => {
        const googleUser = {
          googleId: profile.id,
          email: profile.emails?.[0]?.value,
          fullName: profile.displayName || 'Google User',
          avatarUrl: profile.photos?.[0]?.value || null,
        };

        if (!googleUser.email) {
          return done(new Error('No email returned from Google'));
        }

        done(null, googleUser);
      }
    )
  );

  setGoogleOAuthConfigured();
  logger.info('Google OAuth strategy configured');
}
