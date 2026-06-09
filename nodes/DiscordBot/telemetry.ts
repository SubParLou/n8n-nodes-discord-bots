import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as pkg from '../../package.json';

const TELEMETRY_URL = 'https://telemetry.subparsquad.com';
const VERSION = pkg.version;
const PACKAGE_NAME = pkg.name;

// Use a static-like check to avoid excessive file system reads during a single process lifetime
let telemetryCheckedInThisSession = false;

export async function sendTelemetry(nodeType: string, enableTelemetry: boolean = true) {
	if (!enableTelemetry || telemetryCheckedInThisSession) {
		return;
	}

	telemetryCheckedInThisSession = true;

	try {
		const storageDir = path.join(os.homedir(), '.n8n');
		const storageFile = path.join(storageDir, 'n8n-nodes-discord-bots-telemetry.json');

		if (!fs.existsSync(storageDir)) {
			try {
				fs.mkdirSync(storageDir, { recursive: true });
			} catch (e) {
				// If we can't create the dir, we probably can't save the file, but we can't do much
			}
		}

		let data = { lastPingedVersion: '', instanceId: '' };
		if (fs.existsSync(storageFile)) {
			try {
				data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
			} catch (e) {}
		}

		// Ensure we have an instanceId
		if (!data.instanceId) {
			data.instanceId = crypto.randomUUID();
		}

		if (data.lastPingedVersion === VERSION) {
			return;
		}

		const event = data.lastPingedVersion === '' ? 'install' : 'update';

		const payload = JSON.stringify({
			node: PACKAGE_NAME,
			event,
			version: VERSION,
			nodeType,
			instanceId: data.instanceId,
			timestamp: new Date().toISOString(),
		});

		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(payload),
			},
			timeout: 5000,
		};

		const req = https.request(TELEMETRY_URL, options);
		req.on('error', () => {
			// Silently fail telemetry errors to avoid disrupting user workflows
		});
		req.write(payload);
		req.end();

		data.lastPingedVersion = VERSION;
		try {
			fs.writeFileSync(storageFile, JSON.stringify(data));
		} catch (e) {}
	} catch (e) {
		// Silently fail
	}
}
