import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const backendRoot = path.join(root, 'services/ScadaHub');

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && (entry.name === 'bin' || entry.name === 'obj')) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
  });
}

const csharpFiles = filesUnder(backendRoot).filter((file) => file.endsWith('.cs'));
const backendSource = csharpFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const transportSource = fs.readFileSync(
  path.join(backendRoot, 'Adapters/Mitsubishi/HslMitsubishiPlcTransport.cs'),
  'utf8',
);
const contractSource = fs.readFileSync(
  path.join(backendRoot, 'Adapters/Mitsubishi/IMitsubishiPlcTransport.cs'),
  'utf8',
);
const endpointSource = fs.readFileSync(path.join(backendRoot, 'Api/PureWaterPlcEndpoints.cs'), 'utf8');
const readerSource = fs.readFileSync(
  path.join(backendRoot, 'Adapters/Mitsubishi/PureWaterPlcReader.cs'),
  'utf8',
);
const collectorSource = fs.readFileSync(
  path.join(backendRoot, 'Adapters/Mitsubishi/PureWaterPlcCollector.cs'),
  'utf8',
);
const telemetrySource = fs.readFileSync(
  path.join(backendRoot, 'Contracts/PureWaterPlcTelemetry.cs'),
  'utf8',
);
const appsettings = JSON.parse(fs.readFileSync(path.join(backendRoot, 'appsettings.json'), 'utf8'));
const localExample = JSON.parse(fs.readFileSync(
  path.join(backendRoot, 'appsettings.local.example.json'),
  'utf8',
));
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

assert.match(transportSource, /new MelsecA1ENet\(ipAddress, port\)/);
assert.doesNotMatch(backendSource, /\bMelsecMcNet\b|\bMelsecA1EAsciiNet\b/);
assert.doesNotMatch(contractSource, /\bWrite\w*\s*\(|\bRemote(?:Run|Stop)\b|\bSet(?:PlcType|DateTime)\b/);
assert.doesNotMatch(transportSource, /\.Write\w*\s*\(|\.Remote(?:Run|Stop)\s*\(|\.Set(?:PlcType|DateTime)\s*\(/);
assert.doesNotMatch(endpointSource, /Map(?:Post|Put|Patch|Delete)\s*\(/);
assert.equal(appsettings.PureWaterPlc.Enabled, false);
assert.equal(appsettings.PureWaterPlc.IpAddress, '');
assert.equal(appsettings.PureWaterPlc.Port, 5000);
assert.equal(localExample.PureWaterPlc.Enabled, false);
assert.equal(localExample.PureWaterPlc.IpAddress, '');
assert.match(gitignore, /appsettings\.local\.json/);
assert.match(
  readerSource,
  /SourceId=.*ConnectionGeneration=.*CycleSequence=.*Operation=.*Address=.*Length=.*DurationMs=.*Result=.*ErrorCode=.*ConsecutiveFailures=/s,
);
assert.match(collectorSource, /RepeatedFailureLogInterval\s*=\s*TimeSpan\.FromMinutes\(1\)/);
assert.match(telemetrySource, /required\s+IReadOnlyDictionary<string,\s*int>\s+RawWords/);

const frontendSource = [
  path.join(root, 'src/services/scadaRealtimeClient.ts'),
  path.join(root, 'src/store/pureWaterPlc.ts'),
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
assert.doesNotMatch(frontendSource, /192\.168\.(?:0|1|2)\.|\bMelsecA1ENet\b|\bHslCommunication\b|:5000\b/);

console.log('[check] pure-water backend read-only boundary: 16 assertions passed');
