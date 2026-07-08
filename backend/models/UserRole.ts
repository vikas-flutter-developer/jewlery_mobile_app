import { Schema, model } from "mongoose";

interface IUserRole {
  roleId: string;
  roleName: string;
  description: string;
  permissions: string[];
  status: string;
}

const userRoleSchema = new Schema<IUserRole>(
  {
    roleId: { type: String, required: true, unique: true },
    roleName: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    permissions: [{ type: String }],
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

export default model<IUserRole>("UserRole", userRoleSchema);
