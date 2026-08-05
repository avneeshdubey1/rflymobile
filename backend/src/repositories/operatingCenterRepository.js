const prisma = require('../lib/prisma');

module.exports = {
    create: (data) => prisma.operatingCenter.create({ data }),
    findAll: (where = {}) => prisma.operatingCenter.findMany({ where, orderBy: { createdAt: 'asc' } }),
    findById: (id) => prisma.operatingCenter.findUnique({ where: { id } }),
    findByName: (name) =>
        prisma.operatingCenter.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: "insensitive",
                },
            },
        }),
    update: (id, data) => prisma.operatingCenter.update({ where: { id }, data }),
    delete: (id) => prisma.operatingCenter.delete({ where: { id } }),
    deleteAll: () => prisma.operatingCenter.deleteMany(),
};