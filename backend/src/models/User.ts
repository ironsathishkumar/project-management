import { Schema, model, InferSchemaType } from 'mongoose';
import { addressSchema, emergencyContactSchema, withPublicId } from './plugins';

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    phoneNumber: { type: String, trim: true },
    profileImage: { type: String },
    address: { type: addressSchema },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    emergencyContact: { type: emergencyContactSchema },
    bloodGroup: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(userSchema);


export type UserDocument = InferSchemaType<typeof userSchema> & { id: string };
export const User = model('User', userSchema);
