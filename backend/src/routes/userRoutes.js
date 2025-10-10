import express from 'express';

import { getProfile, updateProfile } from '../controllers/userControllers.js';
import { updateUserMeta } from '../controllers/userMetaController.js';
import { validate } from '../middleware/validate.js';
import auth from '../middleware/auth.js';


const router = express.Router();

router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);
router.patch('/meta', auth, validate(updateUserMeta), updateUserMeta);

export default router;