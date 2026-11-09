const express = require('express');

const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const {
    listQuizzes,
    getQuiz,
    getQuestions,
    createQuiz,
    updateQuiz,
    deactivateQuiz,
    createQuestion,
    submitQuiz
} = require('../controllers/quizController');

const router = express.Router();

router.use(auth);

// User
router.get('/', listQuizzes);
router.get('/:id', getQuiz);
router.get('/:id/questions', getQuestions);
router.post('/:id/submit', submitQuiz);

// Admin
router.post('/', admin, createQuiz);
router.patch('/:id', admin, updateQuiz);
router.delete('/:id', admin, deactivateQuiz);
router.post('/:id/questions', admin, createQuestion);

module.exports = router;