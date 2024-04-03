const Post = require('../models/postModel')
const User = require('../models/userModel')
const path = require('path')
const fs = require('fs')
const {v4: uuid} = require('uuid')
const HttpError = require('../models/errorModel')
const { post } = require('../routes/postRoutes')

// Create post controller.
// POST: api/posts/create
// PROTECTED
const createPost = async (req, res, next) => {
    try {
        let {title, category, description} = req.body;
        if(!title || !category || !description){
            return next(new HttpError("Fill all fields and choose thumbnail"))
        }
        const {thumbnail} = req.files;

        // check thumbnail size
        if(thumbnail.size > 2000000){
            return next(new HttpError("Thumbnail is big, File should be less than 2mb"))
        }
        let fileName = thumbnail.name;
        let splittedFilename = fileName.split('.')
        let newFilename = splittedFilename[0] + uuid() + "." + splittedFilename[splittedFilename.length - 1]
        thumbnail.mv(path.join(__dirname, '..', '/uploads', newFilename), async (err) => {
            if(err){
                return next(new HttpError(err))
            }else{
                const newPost = await Post.create({title, category, description, thumbnail: newFilename, creator: req.user.id})
                if(!newPost){
                    return next(new HttpError("Post could not be created", 422))
                }

                // find user and increase post count by 1
                const currentUser = await User.findById(req.user.id);
                const userPostCount = currentUser.posts +1;
                await User.findByIdAndUpdate(req.user.id, {posts: userPostCount})

                res.status(201).json(newPost)
            }
        })
    } catch (error) {
        return next(new HttpError(error))
    }
}



// Get all posts controller.
// GET: api/posts
// UNPROTECTED
const getPosts = async (req, res, next) => {
    try {
        const posts = await Post.find().sort({updatedAt: -1})
        res.status(200).json(posts)
        
    } catch (error) {
        return next(new HttpError(error))
    }
}



// Get single post controller.
// GET: api/posts/:id
// PROTECTED
const getSinglePost = async (req, res, next) => {
    try {

        const postId = req.params.id;
        const post = await Post.findById(postId);

        if(!post){
            return next(new HttpError("Post not found", 404))
        }

        res.status(200).json(post)
        
    } catch (error) {
        return next(new HttpError(error))
    }
}


// Get posts for specific category controller.
// GET: api/posts/categories/:category
// UNPROTECTED
const getCatPosts = async (req, res, next) => {
    try {
        const {category} = req.params;
        const catPosts = await Post.find({category}).sort({createdAt: -1})
        res.status(200).json(catPosts)
        
    } catch (error) {
        return next(new HttpError(error))
    }
}

// Get posts for specific author/user controller.
// GET: api/posts/users/:id
// UNPROTECTED
const getUserPosts = async (req, res, next) => {
    try {
        const {id} = req.params;
        const posts = await Post.find({creator: id}).sort({createdAt: -1})
        res.status(200).json(posts)
    } catch (error) {
        return next(new HttpError(error))
    }
}

// Edit specific post controller.
// PATCH: api/posts/:id
// PROTECTED
const editPost = async (req, res, next) => {
    try {
        let fileName;
        let newFilename;
        let updatedPost;
        const postId = req.params.id;
        let {title, category, description} = req.body;
        
        if(!title || !category || description.length < 12) {
            return next(new HttpError("Fill all fields", 422))
        }

        // get old post from db
        const oldPost = await Post.findById(postId);
        if(req.user.id == oldPost.creator) {

            if(!req.files){
                updatedPost = await Post.findByIdAndUpdate(postId, {title, category, description}, {new: true})
            }else{
                
                // delete old thumbnail
                fs.unlink(path.join(__dirname, '..', 'uploads', oldPost.thumbnail), async (err) => {
                    if(err){
                        return next(new HttpError(err))
                    }
                })
    
                // upload new thumbnail
                const {thumbnail} = req.files;
                // check file size
                if(thumbnail.size > 2000000){
                    return next(new HttpError("Thumbnail is big, File should be less than 2mb"), 422)
                }
    
                fileName = thumbnail.name;
                let splittedFilename = fileName.split('.')
                newFilename = splittedFilename[0] + uuid() + '.' + splittedFilename[splittedFilename.length - 1]
                thumbnail.mv(path.join(__dirname, '..', '/uploads', newFilename), async (err) => {
                    if(err){
                        return next(new HttpError(err))
                    }
                })
    
                updatedPost = await Post.findByIdAndUpdate(postId, {title, category, description, thumbnail:newFilename}, {new: true})
            }

        }else{
            return next(new HttpError("Could not update post.", 400))
        }
        

        if(!updatedPost){
            return next(new HttpError("Could not update post.", 400))
        }

        res.status(200).json(updatedPost)

    } catch (error) {
        return next(new HttpError(error))
    }
}

// Delete specific post controller.
// DELETE: api/posts/:id
// PROTECTED
const deletePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        if(!postId){
            return next(new HttpError("Post unavailable", 400))
        }
        const post = await Post.findById(postId);
        const fileName = post?.thumbnail;
        if(req.user.id == post.creator){
            // delete thumbnail from uploads folder
            fs.unlink(path.join(__dirname, '..', 'uploads', fileName), async (err) => {
                if(err){            
                    return next(new HttpError(err))
                }else{
                    await Post.findOneAndDelete(postId);
                    // find user and reduce post count by 1 in User table db
                    const currenUser = await User.findById(req.user.id);
                    const userPostCount = currenUser?.posts - 1;
                    await User.findByIdAndUpdate(req.user.id, {posts: userPostCount})
                    res.json(`Post ${postId} is deleted.`)
                }
            })
        }else{
            return next(new HttpError("Post cannot be delete", 403))
        } 
          

    } catch (error) {
        return next(new HttpError(error))
    }
}

module.exports = {createPost, getPosts, getSinglePost, getCatPosts, getUserPosts, editPost, deletePost}