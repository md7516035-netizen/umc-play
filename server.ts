import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

interface SiteConfigSnapshot {
  registrationOpen: boolean;
  registrationClosedMessage: string;
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  maintenanceAnnouncement: string;
}

const DEFAULT_CONFIG: SiteConfigSnapshot = {
  registrationOpen: true,
  registrationClosedMessage: 'Player Registration is Currently Closed.',
  maintenanceEnabled: false,
  maintenanceMessage: 'UMC is currently undergoing scheduled server and tournament platform maintenance.',
  maintenanceAnnouncement: 'Authorized administrators may sign in through the secure management route.',
};

function loadFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      projectId: String(parsed.projectId || ''),
      firestoreDatabaseId: String(parsed.firestoreDatabaseId || '(default)'),
    };
  } catch {
    return null;
  }
}

const fbConfig = loadFirebaseConfig();

let cachedSiteConfig: SiteConfigSnapshot = { ...DEFAULT_CONFIG };
let lastFetchedAt = 0;
const CACHE_TTL_MS = 2000;

async function getLiveSiteConfig(force = false): Promise<SiteConfigSnapshot> {
  const now = Date.now();
  if (!force && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedSiteConfig;
  }
  if (!fbConfig || !fbConfig.projectId) {
    return cachedSiteConfig;
  }
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      fbConfig.projectId
    )}/databases/${encodeURIComponent(fbConfig.firestoreDatabaseId)}/documents/siteConfig/global`;
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      const docJson = (await response.json()) as {
        fields?: Record<string, { booleanValue?: boolean; stringValue?: string }>;
      };
      const fields = docJson.fields;
      if (fields) {
        cachedSiteConfig = {
          registrationOpen:
            typeof fields.registrationOpen?.booleanValue === 'boolean'
              ? fields.registrationOpen.booleanValue
              : true,
          registrationClosedMessage:
            typeof fields.registrationClosedMessage?.stringValue === 'string' &&
            fields.registrationClosedMessage.stringValue.trim().length > 0
              ? fields.registrationClosedMessage.stringValue
              : DEFAULT_CONFIG.registrationClosedMessage,
          maintenanceEnabled:
            typeof fields.maintenanceEnabled?.booleanValue === 'boolean'
              ? fields.maintenanceEnabled.booleanValue
              : false,
          maintenanceMessage:
            typeof fields.maintenanceMessage?.stringValue === 'string' &&
            fields.maintenanceMessage.stringValue.trim().length > 0
              ? fields.maintenanceMessage.stringValue
              : DEFAULT_CONFIG.maintenanceMessage,
          maintenanceAnnouncement:
            typeof fields.maintenanceAnnouncement?.stringValue === 'string'
              ? fields.maintenanceAnnouncement.stringValue
              : DEFAULT_CONFIG.maintenanceAnnouncement,
        };
      }
    }
  } catch {
    // Keep last known config if transient network error occurs
  }
  lastFetchedAt = Date.now();
  return cachedSiteConfig;
}

const ADMIN_BYPASS_PATHS = ['/admin-portal', '/admin-login', '/admin'];

function isAdminManagementPath(reqPath: string): boolean {
  return ADMIN_BYPASS_PATHS.some(
    (prefix) => reqPath === prefix || reqPath.startsWith(`${prefix}/`)
  );
}

function isAssetOrInternalPath(reqPath: string): boolean {
  return (
    reqPath.startsWith('/api/') ||
    reqPath.startsWith('/assets/') ||
    reqPath.startsWith('/src/') ||
    reqPath.startsWith('/@') ||
    reqPath.startsWith('/node_modules/') ||
    reqPath.includes('.')
  );
}

const STRICT_HTTP_503 = process.env.STRICT_HTTP_503 === 'true';

function isBrowserPageRequest(req: Request): boolean {
  const accept = String(req.headers.accept || '');
  const ua = String(req.headers['user-agent'] || '');
  return accept.includes('text/html') && ua.includes('Mozilla');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', async (_req: Request, res: Response) => {
    const config = await getLiveSiteConfig();
    res.json({
      ok: true,
      maintenanceEnabled: config.maintenanceEnabled,
      registrationOpen: config.registrationOpen,
    });
  });

  app.get('/api/site-status', async (_req: Request, res: Response) => {
    const config = await getLiveSiteConfig();
    res.json(config);
  });

  app.get('/api/maintenance-status', async (_req: Request, res: Response) => {
    const config = await getLiveSiteConfig();
    if (config.maintenanceEnabled) {
      res.status(STRICT_HTTP_503 ? 503 : 200).set('Retry-After', '3600').json({
        available: false,
        status: 503,
        maintenanceMessage: config.maintenanceMessage,
        maintenanceAnnouncement: config.maintenanceAnnouncement,
      });
      return;
    }
    res.status(200).json({ available: true, status: 200 });
  });

  app.post('/api/site-status/refresh', async (_req: Request, res: Response) => {
    const config = await getLiveSiteConfig(true);
    res.json({ refreshed: true, config });
  });

  app.post('/api/validate-registration', async (req: Request, res: Response) => {
    const config = await getLiveSiteConfig(true);
    if (!config.registrationOpen) {
      res.status(403).json({
        valid: false,
        error: config.registrationClosedMessage || 'Player Registration is Currently Closed.',
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const existingAuthAccount = body.existingAuthAccount === true;
    const fullName = String(body.fullName || '').trim();
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');
    const country = String(body.country || '').trim();
    const state = String(body.state || '').trim();
    const district = String(body.district || '').trim();
    const minecraftUsername = String(body.minecraftUsername || '').trim();
    const minecraftEdition = String(body.minecraftEdition || '').trim();
    const age = Number(body.age);
    const contactDetails = String(body.contactDetails || '').trim();

    if (fullName.length < 2 || fullName.length > 80) {
      res.status(400).json({ valid: false, error: 'Full name must be between 2 and 80 characters.' });
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      res.status(400).json({
        valid: false,
        error: 'Username must be 3–30 characters using only letters, numbers, and underscores.',
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      res.status(400).json({ valid: false, error: 'Please provide a valid email address.' });
      return;
    }
    if (!existingAuthAccount) {
      if (password.length < 8 || password.length > 128) {
        res.status(400).json({ valid: false, error: 'Password must be at least 8 characters long.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ valid: false, error: 'Password and confirm password do not match.' });
        return;
      }
    }
    if (country.length < 2 || country.length > 60 || state.length < 2 || state.length > 60 || district.length < 2 || district.length > 60) {
      res.status(400).json({ valid: false, error: 'Country, state, and district must each be 2–60 characters.' });
      return;
    }
    if (!/^[a-zA-Z0-9_ ]{3,32}$/.test(minecraftUsername)) {
      res.status(400).json({
        valid: false,
        error: 'Minecraft username must be 3–32 valid characters.',
      });
      return;
    }
    if (!['JAVA', 'BEDROCK', 'BOTH'].includes(minecraftEdition)) {
      res.status(400).json({ valid: false, error: 'Invalid Minecraft edition selected.' });
      return;
    }
    if (!Number.isInteger(age) || age < 13 || age > 99) {
      res.status(400).json({ valid: false, error: 'Age must be an integer between 13 and 99.' });
      return;
    }
    if (contactDetails.length < 3 || contactDetails.length > 120) {
      res.status(400).json({ valid: false, error: 'Contact details must be between 3 and 120 characters.' });
      return;
    }

    res.json({ valid: true });
  });

  app.post('/api/validate-contact', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const minecraftUsername = String(body.minecraftUsername || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ valid: false, error: 'Name must be between 2 and 80 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      res.status(400).json({ valid: false, error: 'Please provide a valid email address.' });
      return;
    }
    if (minecraftUsername.length > 32) {
      res.status(400).json({ valid: false, error: 'Minecraft username cannot exceed 32 characters.' });
      return;
    }
    if (subject.length < 3 || subject.length > 140) {
      res.status(400).json({ valid: false, error: 'Subject must be between 3 and 140 characters.' });
      return;
    }
    if (message.length < 10 || message.length > 3000) {
      res.status(400).json({ valid: false, error: 'Message must be between 10 and 3000 characters.' });
      return;
    }

    res.json({ valid: true });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || isAssetOrInternalPath(req.path) || !isBrowserPageRequest(req)) {
        return next();
      }
      const config = await getLiveSiteConfig();
      if (config.maintenanceEnabled && !isAdminManagementPath(req.path)) {
        try {
          const templatePath = path.resolve(__dirname, 'index.html');
          let template = fs.readFileSync(templatePath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          // Note: AI Studio's nginx reverse proxy intercepts 503 HTML responses and shows "Starting Server...".
          // When STRICT_HTTP_503=true (standalone production hosting), respond with literal HTTP 503.
          const httpStatus = STRICT_HTTP_503 ? 503 : 200;
          res
            .status(httpStatus)
            .set({
              'Content-Type': 'text/html; charset=utf-8',
              'Retry-After': '3600',
              'Cache-Control': 'no-store',
              'X-UMC-Maintenance': '503',
            })
            .send(template);
          return;
        } catch (err) {
          vite.ssrFixStacktrace(err as Error);
          return next(err);
        }
      }
      return next();
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));

    app.get('*', async (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const indexFile = path.resolve(distDir, 'index.html');
      const config = await getLiveSiteConfig();
      if (config.maintenanceEnabled && !isAdminManagementPath(req.path) && isBrowserPageRequest(req)) {
        const httpStatus = STRICT_HTTP_503 ? 503 : 200;
        res
          .status(httpStatus)
          .set({
            'Retry-After': '3600',
            'Cache-Control': 'no-store',
            'X-UMC-Maintenance': '503',
          })
          .sendFile(indexFile);
        return;
      }
      res.sendFile(indexFile);
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UMC server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
