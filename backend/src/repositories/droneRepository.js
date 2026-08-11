const prisma = require('../lib/prisma');
const { setHistoryActor } = require('./historyActorRepository');

const include = { homeCenter: true };

module.exports = {
    create: (data, options = {}) => prisma.$transaction(async (transaction) => {
        await setHistoryActor(transaction, options.actorId);
        return transaction.drone.create({ data, include });
    }),
    findAll: (where = {}) => prisma.drone.findMany({ where, include, orderBy: { createdAt: 'desc' } }),
    findById: (id) => prisma.drone.findUnique({ where: { id }, include }),
    findByUin: (uin) =>
        prisma.drone.findUnique({
            where: { uin }
        }),
    update: (id, data, options = {}) => prisma.$transaction(async (transaction) => {
        await setHistoryActor(transaction, options.actorId);
        return transaction.drone.update({ where: { id }, data, include });
    }),
    deleteAll: () => prisma.drone.deleteMany(),
};
