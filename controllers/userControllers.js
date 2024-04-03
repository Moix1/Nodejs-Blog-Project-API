const bcrypt = require('bcryptjs')
const jwt = require("jsonwebtoken")
const fs = require('fs')
const path = require('path')
const {v4: uuid} = require("uuid")

const HttpError = require("../models/errorModel")
const User = require("../models/userModel")

// Register New User Controller
// POST: api/users/register
// UNPROTCTED


const registerUser = async (req, res, next) => {
    try {
        const {name, email, password, password2} = req.body;
        
        if(!name || !email || !password){
            return next(new HttpError("Fill in all fields", 422))
        }

        const newEmail = email.toLowerCase()

        const emailExists = await User.findOne({email: newEmail})
        
        if(emailExists){
            return next(new HttpError("Email already exists", 422))
        }
        
        if((password.trim()).length < 6){
            return next(new HttpError("Password should be more than 6 characters", 424))
        }

        if(password != password2){
            return next(new HttpError("Password doesn't match", 422))
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPass = await bcrypt.hash(password, salt)

        const newUser = await User.create({name, email: newEmail, password: hashedPass})
        res.status(201).json(`Registration is done, welcome ${newUser.name}!`)

    } catch (error) {
        return next(new HttpError("User registration failed.", 422))
    }
}

// User Login Controller
// POST: api/users/login
// UNPROTCTED
const loginUser = async (req, res, next) => {
    try {
        const {email, password} = req.body;

        if(!email || !password){
            return next(new HttpError("Please fill all fields", 422))
        }

        const newEmail = email.toLowerCase();

        const user = await User.findOne({email: newEmail})
        if(!user){
            return next(new HttpError("Invalid credentials", 422))
        }

        const comparePass = await bcrypt.compare(password, user.password)
        if(!comparePass){
            return next(new HttpError("Invalid credentials", 422))
        }

        const {_id: id, name} = user;
        const token = jwt.sign({id, name}, process.env.JWT_SECRET, {expiresIn: "1d"})

        res.status(200).json({token, id, name})

    } catch (error) {
        return next(new HttpError("Login failed, Please check your credentials"))
    }
}


// User Profile Controller
// POST: api/users/:id
// PROTCTED
const getUser = async (req, res, next) => {
    try {
        
        const {id} = req.params;
        const user = await User.findById(id).select('-password');
        if(!user){
            return next(new HttpError("User not found", 404))
        }

        res.status(200).json(user);

    } catch (error) {
        return next(new HttpError(error))
    }
}

// User Profile Avatar Controller
// POST: api/users/change-avatar
// PROTCTED
const changeAvatar = async (req, res, next) => {
    try {
        if(!req.files.avatar){
            return next(new HttpError("Please choose image", 422))
        }

        // find user from database to authenticate before change avatar
        const user = await User.findById(req.user.id)
        
        // Delete old avatar if exists
        if(user.avatar){
            fs.unlink(path.join(__dirname, '..', 'uploads', user.avatar), (err) => {
                if(err){
                    return next(new HttpError(err))
                }
            })
        }

        const {avatar} = req.files;
        if(avatar.size > 500000){
            return next(new HttpError("Profile image size is big, should be less than 500kb", 422))
        }


        let fileName;
        fileName = avatar.name;
        let splittedFilename = fileName.split('.')
        let newFilename = splittedFilename[0] + uuid() + '.' + splittedFilename[splittedFilename.length - 1]
        avatar.mv(path.join(__dirname, '..', 'uploads', newFilename), async (err) => {
            if(err){
                return next(new HttpError(err))
            }

            const updatedAvatar = await User.findByIdAndUpdate(req.user.id, {avatar: newFilename}, {new: true})
            if(!updatedAvatar){
                return next(new HttpError("Avatar couldn't be change", 422))
            }
            res.status(200).json(updatedAvatar)
        })


    } catch (error) {
        return next(new HttpError(error))
    }
}

// User Details Controller
// POST: api/users/edit-user
// PROTCTED
const editUser = async (req, res, next) => {
    try {
        const {name, email, currentPassword, newPassword, confirNewPassword} = req.body;
        if(!name || !email || !currentPassword || !newPassword){
            return next(new HttpError("Fill all fields", 422))
        }

        // get user from database
        const user = await User.findById(req.user.id);
        if(!user){
            return next(new HttpError("User not found", 403))
        }

        // make sure new email is not in db already
        const emailExist = await User.findOne({email});

        // Change user details with email or without it, but only logged user can.
        if(emailExist && (emailExist._id != req.user.id)){
            return next(new HttpError("Email already exists", 422))
        }

        // compare current password with db password
        const validateUserPassword = await bcrypt.compare(currentPassword, user.password);
        if(!validateUserPassword){
            return next(new HttpError("Invalid current password", 422))
        }

        // compare new password
        if(newPassword !== confirNewPassword){
            return next(new HttpError("New password do not match", 422))
        }

        // has new password
        const salt = await bcrypt.genSalt(10)
        const hash = await bcrypt.hash(newPassword, salt);

        // Update user details in db
        const newInfo = await User.findByIdAndUpdate(req.user.id, {name, email, password: hash}, {new: true})
        res.status(200).json(newInfo)

    } catch (error) {
        return next(new HttpError(error))
    }
}

// Get All Users/Authors Controller
// POST: api/users/authors
// PROTCTED
const getAuthors = async (req, res, next) => {
    try {
        const authors = await User.find().select('-password');
        res.json(authors)
    } catch (error) {
        return next(new HttpError(error))
    }
}

module.exports = {registerUser, loginUser, getUser, changeAvatar, editUser, getAuthors}