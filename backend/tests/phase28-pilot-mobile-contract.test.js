const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const contractDirectory = path.resolve(__dirname, '../contracts/mobile/v1');
const fixtureDirectory = path.join(contractDirectory, 'fixtures');
const schema = JSON.parse(fs.readFileSync(path.join(contractDirectory, 'mobile-api.schema.json'), 'utf8'));

const fixtureContracts = Object.freeze({
  'login-request.json': 'loginRequest',
  'login-response.json': 'loginResponse',
  'assignment.json': 'assignment',
  'bootstrap-response.json': 'bootstrapResponse',
  'mutation-receipt.json': 'mutationReceipt',
  'change-page.json': 'changePage',
  'conflict-response.json': 'errorResponse',
});

const runtimeValues = Object.freeze({
  __GENERATED_PASSWORD__: `generated-${crypto.randomBytes(18).toString('base64url')}`,
  __GENERATED_INSTALLATION_KEY__: crypto.randomBytes(48).toString('base64url'),
  __GENERATED_TOKEN__: crypto.randomBytes(48).toString('base64url'),
  __GENERATED_PHONE__: '+919000000001',
  __GENERATED_PLUS_CODE__: '7JQJ+XX Example',
  __GENERATED_LATITUDE__: 0.125,
  __GENERATED_LONGITUDE__: -0.125,
});

function hydrate(value) {
  if (Array.isArray(value)) return value.map(hydrate);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, hydrate(child)]));
  }
  return Object.prototype.hasOwnProperty.call(runtimeValues, value) ? runtimeValues[value] : value;
}

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDirectory, name), 'utf8'));
}

function compileDefinition(ajv, definition) {
  return ajv.compile({
    $schema: schema.$schema,
    $ref: `${schema.$id}#/$defs/${definition}`,
  });
}

test('stored mobile fixtures contain placeholders instead of credentials, tokens, phones, or coordinates', () => {
  const loginRequest = fixture('login-request.json');
  const loginResponse = fixture('login-response.json');
  const assignment = fixture('assignment.json');

  assert.equal(loginRequest.password, '__GENERATED_PASSWORD__');
  assert.equal(loginRequest.installationKey, '__GENERATED_INSTALLATION_KEY__');
  assert.equal(loginResponse.session.accessToken, '__GENERATED_TOKEN__');
  assert.equal(assignment.farmer.operationalPhone, '__GENERATED_PHONE__');
  assert.equal(assignment.farm.plusCode, '__GENERATED_PLUS_CODE__');
  assert.equal(assignment.farm.latitude, '__GENERATED_LATITUDE__');
  assert.equal(assignment.farm.longitude, '__GENERATED_LONGITUDE__');
  assert.match(loginRequest.email, /@example\.invalid$/);
});

test('every sanitized Pilot mobile fixture validates against its strict v1 contract', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(schema);

  for (const [file, definition] of Object.entries(fixtureContracts)) {
    const validate = compileDefinition(ajv, definition);
    const valid = validate(hydrate(fixture(file)));
    assert.equal(valid, true, `${file}: ${ajv.errorsText(validate.errors)}`);
  }
});

test('assignment and error contracts reject accidental fields and keep error codes unique', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(schema);

  const assignment = hydrate(fixture('assignment.json'));
  assignment.farmer.crmHistory = 'must never cross the mobile boundary';
  assert.equal(compileDefinition(ajv, 'assignment')(assignment), false);

  const codes = schema.$defs.errorResponse.properties.error.properties.code.enum;
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.includes('AUTHENTICATION_REQUIRED'));
  assert.ok(codes.includes('ASSIGNMENT_REVISION_CONFLICT'));
  assert.ok(codes.includes('CLIENT_UPGRADE_REQUIRED'));
  assert.ok(codes.includes('INTERNAL_ERROR'));
});
