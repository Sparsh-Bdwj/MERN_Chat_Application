import { generateToken } from "../libs/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../libs/cloudinary.js";

// setting us the signup controller for the user
export const signup = async (req, res) => {
  const { fullName, email, password, bio } = req.body;
  try {
    if (!fullName || !email || !password || !bio) {
      return res
        .status(400)
        .json({ success: false, message: "Missing Details" });
    }
    const user = await User.findOne({ email });
    if (user) {
      return res
        .status(409)
        .json({ success: false, message: "Account already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      bio,
    });
    const token = generateToken(newUser._id);
    // to improve or sercure the user we will send the newUser with the password feild
    const userObj = newUser.toObject();
    const { password: _, ...userWithoutPassword } = userObj;
    return res.status(201).json({
      success: true,
      userData: userWithoutPassword,
      token,
      message: "Account Created Successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// setting up the login controller for the user
export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Missing email or password" });
    }
    const userData = await User.findOne({ email });
    if (!userData) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid Credentials" });
    }
    const isPasswordCorrest = await bcrypt.compare(password, userData.password);
    if (!isPasswordCorrest) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid Credentials" });
    }
    // genetrate the token
    const token = generateToken(userData._id);
    const userObj = userData.toObject();
    const { password: _, ...userWithoutPassword } = userObj;
    return res.status(200).json({
      success: true,
      message: "Login successfully",
      userData: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// setting up the controller to check weather the user is authanticated or not
export const checkAuth = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// setting up the controller to update user profile details
export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName } = req.body;
    const userId = req.user._id; // beacause will passed to protected route
    if (!profilePic && !bio && !fullName) {
      return res
        .status(400)
        .json({ success: false, message: "No updated fields provided" });
    }
    let updatedData = {};
    if (bio && bio.trim() !== "") updatedData.bio = bio;
    if (fullName && fullName.trim() !== "") updatedData.fullName = fullName;
    if (profilePic) {
      const upload = await cloudinary.uploader.upload(profilePic, {
        folder: "user_profiles",
        resource_type: "auto",
      });
      updatedData.profilePic = upload.secure_url;
    }
    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
