import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import "dotenv/config";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { HttpError } from "../Helpers/index.js";
import { ctrlWrapper } from "../decorators/index.js";
import gravatar from "gravatar";
import Jimp from "jimp";

const { JWT_SECRET } = process.env;

const avatarPath = path.resolve("public", "avatars");

const signup = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    throw HttpError(409, "Email in use");
  }
  const avatarURL = gravatar.url(email, { s: "250" });
  const hashPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    ...req.body,
    avatarURL,
    password: hashPassword,
  });

  res.status(201).json({
    user: {
      email: newUser.email,
      subscription: newUser.subscription,
      avatarURL,
    },
  });
};

const signin = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, "Email or password is wrong");
  }
  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, "Email or password is wrong");
  }

  const payload = {
    id: user._id,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "23h" });
  await User.findByIdAndUpdate(user._id, { token });
  res.json({
    token,
    user: {
      email: user.email,
      subscription: user.subscription,
    },
  });
};

const getCurrent = (req, res) => {
  const { email, subscription } = req.user;

  res.json({ email, subscription });
};

const signout = async (req, res) => {
  const { _id } = req.user;

  await User.findByIdAndUpdate(_id, { token: "" });
  res.status(204).json();
};

const updateAvatar = async (req, res) => {
  const { _id } = req.user;
  const { path: oldPath, filename } = req.file;
  const image = await Jimp.read(oldPath);
  image.resize(250, 250);
  await image.writeAsync(oldPath);

  const newPath = path.join(avatarPath, filename);
  await fs.rename(oldPath, newPath);

  const avatarURL = path.join("avatars", filename);
  const result = await User.findByIdAndUpdate(
    _id,
    { avatarURL },
    {
      new: true,
    }
  );

  if (!result) {
    throw HttpError(404);
  }
  res.json({ avatarURL: result.avatarURL });
};

export default {
  signup: ctrlWrapper(signup),
  signin: ctrlWrapper(signin),
  getCurrent: ctrlWrapper(getCurrent),
  signout: ctrlWrapper(signout),
  updateAvatar: ctrlWrapper(updateAvatar),
};
