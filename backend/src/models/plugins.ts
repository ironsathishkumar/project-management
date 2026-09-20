import { Schema } from 'mongoose';
import { createPublicId } from '../utils/ids';

export function withPublicId(schema: Schema): void {
  schema.add({
    id: {
      type: String,
      required: true,
      unique: true,
      default: createPublicId,
    },
  });
  schema.set('toJSON', {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      return ret;
    },
  });
}

export const addressSchema = new Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  { _id: false }
);

export const emergencyContactSchema = new Schema(
  {
    name: String,
    relationship: String,
    phoneNumber: String,
  },
  { _id: false }
);
