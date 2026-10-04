import fs from 'fs';
import { execSync } from 'child_process';

const schemaUrl = 'http://localhost:8000/api/schema/';
const output = 'src/lib/api-schema.ts';
const isCheck = process.argv.includes('--check');

try {
  console.log(`Generating API types from ${schemaUrl} to ${output}...`);
  execSync(`npx openapi-typescript ${schemaUrl} -o ${output}`, { stdio: 'inherit' });
  
  if (isCheck) {
    try {
      const status = execSync(`git status --porcelain ${output}`).toString();
      if (status) {
        console.error('API types are out of sync. Please run `npm run gen:api` and commit the changes.');
        process.exit(1);
      }
    } catch (e) {
      // Ignore if not in a git repo
    }
  }
} catch (error) {
  console.warn('Failed to generate API types (backend might be down):', error.message);
  // Do not fail hard so build can continue without backend during dev setup
}
