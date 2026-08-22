-- Client-provided cluster locations have not yet been classified as hubs,
-- spokes, or mini-hubs. Keep that honest rather than mislabelling them.
ALTER TYPE "ClusterType" ADD VALUE IF NOT EXISTS 'CLUSTER';
