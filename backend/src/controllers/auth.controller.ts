import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { User } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { WorkspaceMember, Role } from '../models';

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, result);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOne({ id: req.authUser!.id });
    if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');
    const memberships = await WorkspaceMember.find({ userId: user.id, status: 'ACTIVE' });
    const roles = await Role.find({ id: { $in: memberships.map((item) => item.roleId) } });
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    sendSuccess(res, {
      ...user.toJSON(),
      memberships: memberships.map((membership) => ({
        ...membership.toJSON(),
        role: roleMap.get(membership.roleId) ?? null,
      })),
    });
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOneAndUpdate({ id: req.authUser!.id }, req.body, { new: true });
    sendSuccess(res, user);
  }),
};
