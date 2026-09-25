import path from 'node:path';
import {dataDir} from './db';
// Written by scripts/sync-listings.mjs, which resolves the same DATA_DIR.
export const cachePath = path.join(dataDir, 'live-listings.json');
