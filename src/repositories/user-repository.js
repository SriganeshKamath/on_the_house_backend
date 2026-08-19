const { prisma } = require('../config/prisma');

class UserRepository {
  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username) {
    return prisma.user.findUnique({ where: { username } });
  }

  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  create({ username, email, passwordHash }) {
    return prisma.user.create({
      data: { username, email, passwordHash },
    });
  }
}

module.exports = { UserRepository };
