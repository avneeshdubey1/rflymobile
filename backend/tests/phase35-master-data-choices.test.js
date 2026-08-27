const assert = require('node:assert/strict');
const test = require('node:test');

const repository = require('../src/repositories/masterDataRepository');
const { cropValues, MAPPING_VERSION } = require('../importer/clientMasterWorkbookV1');

test('client-master crop codes follow the lowercase database contract', () => {
  assert.equal(MAPPING_VERSION, 'RFLY_CLIENT_MASTER_WORKBOOK_V4');
  assert.deepEqual(cropValues([
    ['Crop Type'],
    ['Paddy'],
    ['Black Gram'],
  ]), [
    { code: 'paddy', displayName: 'Paddy', normalizedName: 'paddy' },
    { code: 'black_gram', displayName: 'Black Gram', normalizedName: 'blackgram' },
  ]);
});

test('master-data choices preserve every independently loaded category', async () => {
  const original = {
    listClusters: repository.listClusters,
    listCrops: repository.listCrops,
    listValues: repository.listValues,
  };
  const servicePath = require.resolve('../services/masterDataService');

  const clusters = [{ id: 'cluster-1', code: 'CLUSTER_1' }];
  const crops = [{ id: 'crop-1', code: 'CROP_1' }];
  const values = {
    SPRAY_PURPOSE: [{ id: 'purpose-1', code: 'PURPOSE_1' }],
    B2B_SUBCATEGORY: [{ id: 'b2b-1', code: 'B2B_1' }],
    B2C_CLASSIFICATION: [{ id: 'b2c-1', code: 'B2C_1' }],
    LEAD_SOURCE: [{ id: 'source-1', code: 'SOURCE_1' }],
    REPORTING_ADMIN: [{ id: 'admin-1', code: 'ADMIN_1' }],
  };

  repository.listClusters = async () => clusters;
  repository.listCrops = async () => crops;
  repository.listValues = async (category) => values[category];
  delete require.cache[servicePath];

  try {
    const service = require('../services/masterDataService');
    const result = await service.choices();

    assert.deepEqual(result, {
      requestTypes: ['B2B', 'B2C'],
      clusterTypes: ['CLUSTER', 'HUB', 'SPOKE', 'MINIHUB'],
      clusters,
      crops,
      sprayPurposes: values.SPRAY_PURPOSE,
      b2bSubcategories: values.B2B_SUBCATEGORY,
      b2cClassifications: values.B2C_CLASSIFICATION,
      leadSources: values.LEAD_SOURCE,
      reportingAdmins: values.REPORTING_ADMIN,
    });
  } finally {
    repository.listClusters = original.listClusters;
    repository.listCrops = original.listCrops;
    repository.listValues = original.listValues;
    delete require.cache[servicePath];
  }
});
