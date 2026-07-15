import type { Request, Response } from 'express';
import { usersService } from './users.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import type { CreateUserInput, UpdateUserStatusInput } from './users.schema.js';

export class UsersController {
  async list(_req: Request, res: Response): Promise<void> {
    const data = await usersService.listUsers();
    ApiResponse.success(res, data);
  }

  async create(req: Request, res: Response): Promise<void> {
    const data = await usersService.createUser(req.body as CreateUserInput);
    ApiResponse.created(res, data);
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const data = await usersService.updateUserStatus(req.params.id as string, req.body as UpdateUserStatusInput);
    ApiResponse.success(res, data);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await usersService.deleteUser(req.params.id as string);
    ApiResponse.success(res, { message: 'User deleted successfully' });
  }
}

export const usersController = new UsersController();
