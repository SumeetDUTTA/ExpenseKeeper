import express from 'express';

import { getProfile, updateProfile, deleteUser } from '../controllers/userControllers.js';
import { updateUserMeta } from '../controllers/userMetaController.js';
import { updateUserMetaSchema } from '../validators/userValidator.js';
import { validate } from '../middleware/validate.js';
import auth from '../middleware/auth.js';


const router = express.Router();

router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);
router.delete('/profile/delete', auth, deleteUser);
router.patch('/meta', auth, validate(updateUserMetaSchema), updateUserMeta);

export default router;