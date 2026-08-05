const prisma = require('../lib/prisma');

module.exports = {
    create: (data) => prisma.drone.create({ data, include: { homeCenter: true } }),
    findAll: (where = {}) => prisma.drone.findMany({ where, include: { homeCenter: true }, orderBy: { createdAt: 'desc' } }),
    findById: (id) => prisma.drone.findUnique({ where: { id }, include: { homeCenter: true } }),
    findByUin: (uin) =>
        prisma.drone.findUnique({
            where: { uin }
        }),
    update: (id, data) => prisma.drone.update({ where: { id }, data, include: { homeCenter: true } }),
    remove: (id) => prisma.drone.delete({ where: { id } }),
    deleteAll: () => prisma.drone.deleteMany(),
};