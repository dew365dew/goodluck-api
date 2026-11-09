
const supabase = require('../config/supabase');
const { success, created, error } = require('../core/response');


// ==============================
// GET /api/quizzes
// ==============================

async function listQuizzes(req, res) {
    try {
        const { data, error: dbError } = await supabase
            .from('quizzes')
            .select(`
                id,
                title,
                description,
                quiz_type,
                status,
                starts_at,
                ends_at,
                created_at
            `)
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        if (dbError) {
            console.error('List quizzes:', dbError);
            return error(res, 'Unable to load quizzes', 500);
        }

        return success(res, data, 'Quizzes loaded');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// GET /api/quizzes/:id
// ==============================

async function getQuiz(req, res) {
    try {
        const { data, error: dbError } = await supabase
            .from('quizzes')
            .select(`
                id,
                title,
                description,
                quiz_type,
                status,
                starts_at,
                ends_at,
                created_at
            `)
            .eq('id', req.params.id)
            .eq('status', 'open')
            .maybeSingle();

        if (dbError) {
            console.error('Get quiz:', dbError);
            return error(res, 'Database error', 500);
        }

        if (!data) {
            return error(res, 'Quiz not found', 404);
        }

        return success(res, data, 'Quiz loaded');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// GET /api/quizzes/:id/questions
// ==============================

async function getQuestions(req, res) {
    try {
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select('id,status')
            .eq('id', req.params.id)
            .eq('status', 'open')
            .maybeSingle();

        if (quizError) {
            console.error(quizError);
            return error(res, 'Database error', 500);
        }

        if (!quiz) {
            return error(res, 'Quiz not found', 404);
        }

        const { data, error: dbError } = await supabase
            .from('quiz_questions')
            .select(`
                id,
                question,
                points,
                question_order,
                quiz_options (
                    id,
                    option_text,
                    option_order
                )
            `)
            .eq('quiz_id', req.params.id)
            .order('question_order', { ascending: true });

        if (dbError) {
            console.error(dbError);
            return error(res, 'Unable to load questions', 500);
        }

        return success(res, data, 'Questions loaded');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// POST /api/quizzes
// ADMIN
// ==============================

async function createQuiz(req, res) {
    try {
        const {
            title,
            description = null,
            quiz_type = 'general',
            starts_at = null,
            ends_at = null
        } = req.body;

        if (!title || !String(title).trim()) {
            return error(res, 'Title is required', 400);
        }

        const validTypes = ['number', 'football', 'general'];

        if (!validTypes.includes(quiz_type)) {
            return error(res, 'Invalid quiz type', 400);
        }

        if (
            starts_at &&
            ends_at &&
            Date.parse(ends_at) <= Date.parse(starts_at)
        ) {
            return error(res, 'Invalid quiz date range', 400);
        }

        // Ensure admin profile exists
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', req.user.id)
            .maybeSingle();

        if (profileError || !profile) {
            console.error('Admin profile missing:', profileError);
            return error(res, 'Admin profile not found', 400);
        }

        const { data, error: dbError } = await supabase
            .from('quizzes')
            .insert({
                title: String(title).trim(),
                description,
                quiz_type,
                status: 'draft',
                starts_at,
                ends_at,
                created_by: profile.id
            })
            .select()
            .single();

        if (dbError) {
            console.error('Create quiz:', dbError);
            return error(res, 'Unable to create quiz', 500);
        }

        return created(res, data, 'Quiz created');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// PATCH /api/quizzes/:id
// ADMIN
// ==============================

async function updateQuiz(req, res) {
    try {
        const allowed = [
            'title',
            'description',
            'quiz_type',
            'status',
            'starts_at',
            'ends_at'
        ];

        const updates = {};

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return error(res, 'No fields to update', 400);
        }

        if (
            updates.title !== undefined &&
            !String(updates.title).trim()
        ) {
            return error(res, 'Invalid title', 400);
        }

        if (
            updates.quiz_type !== undefined &&
            !['number', 'football', 'general'].includes(updates.quiz_type)
        ) {
            return error(res, 'Invalid quiz type', 400);
        }

        if (
            updates.status !== undefined &&
            !['draft', 'open', 'closed', 'settled'].includes(updates.status)
        ) {
            return error(res, 'Invalid quiz status', 400);
        }

        if (updates.title !== undefined) {
            updates.title = String(updates.title).trim();
        }

        updates.updated_at = new Date().toISOString();

        const { data, error: dbError } = await supabase
            .from('quizzes')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .maybeSingle();

        if (dbError) {
            console.error('Update quiz:', dbError);
            return error(res, 'Unable to update quiz', 500);
        }

        if (!data) {
            return error(res, 'Quiz not found', 404);
        }

        return success(res, data, 'Quiz updated');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// DELETE /api/quizzes/:id
// ADMIN
// Close instead of deleting
// ==============================

async function deactivateQuiz(req, res) {
    try {
        const { data, error: dbError } = await supabase
            .from('quizzes')
            .update({
                status: 'closed',
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .maybeSingle();

        if (dbError) {
            console.error(dbError);
            return error(res, 'Unable to close quiz', 500);
        }

        if (!data) {
            return error(res, 'Quiz not found', 404);
        }

        return success(res, data, 'Quiz closed');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// POST /api/quizzes/:id/questions
// ADMIN
// ==============================

async function createQuestion(req, res) {
    try {
        const {
            question,
            points = 1,
            question_order = 1,
            options
        } = req.body;

        if (
            typeof question !== 'string' ||
            !question.trim() ||
            !Array.isArray(options) ||
            options.length < 2
        ) {
            return error(
                res,
                'Question and at least two options are required',
                400
            );
        }

        if (
            !Number.isInteger(Number(points)) ||
            Number(points) < 0
        ) {
            return error(res, 'Invalid points', 400);
        }

        if (
            !Number.isInteger(Number(question_order)) ||
            Number(question_order) < 1
        ) {
            return error(res, 'Invalid question order', 400);
        }

        const cleanedOptions = options.map(o => ({
            option_text: String(o.option_text || '').trim(),
            is_correct: o.is_correct === true
        }));

        if (cleanedOptions.some(o => !o.option_text)) {
            return error(res, 'Every option needs option_text', 400);
        }

        if (cleanedOptions.filter(o => o.is_correct).length !== 1) {
            return error(
                res,
                'Exactly one option must be correct',
                400
            );
        }

        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select('id,status')
            .eq('id', req.params.id)
            .maybeSingle();

        if (quizError) {
            console.error(quizError);
            return error(res, 'Database error', 500);
        }

        if (!quiz) {
            return error(res, 'Quiz not found', 404);
        }

        if (quiz.status !== 'draft') {
            return error(
                res,
                'Questions can only be added to draft quizzes',
                400
            );
        }

        const { data: savedQuestion, error: qError } = await supabase
            .from('quiz_questions')
            .insert({
                quiz_id: req.params.id,
                question: question.trim(),
                points: Number(points),
                question_order: Number(question_order)
            })
            .select()
            .single();

        if (qError) {
            console.error(qError);
            return error(res, 'Unable to create question', 500);
        }

        const optionRows = cleanedOptions.map((o, index) => ({
            question_id: savedQuestion.id,
            option_text: o.option_text,
            option_order: index + 1,
            is_correct: o.is_correct
        }));

        const { data: savedOptions, error: optionError } = await supabase
            .from('quiz_options')
            .insert(optionRows)
            .select('id,option_text,option_order');

        if (optionError) {
            console.error(optionError);

            // Attempt to remove incomplete question
            const { error: cleanupError } = await supabase
                .from('quiz_questions')
                .delete()
                .eq('id', savedQuestion.id);

            if (cleanupError) {
                console.error('Question cleanup failed:', cleanupError);
            }

            return error(res, 'Unable to create options', 500);
        }

        return created(res, {
            ...savedQuestion,
            options: savedOptions
        }, 'Question created');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// POST /api/quizzes/:id/submit
// USER
// ==============================

async function submitQuiz(req, res) {
    try {
        const { answers } = req.body;

        if (!Array.isArray(answers) || answers.length === 0) {
            return error(res, 'Answers are required', 400);
        }

        // Verify profile exists
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', req.user.id)
            .maybeSingle();

        if (profileError || !profile) {
            console.error(profileError);
            return error(res, 'User profile not found', 400);
        }

        // Load quiz
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select('id,status,starts_at,ends_at')
            .eq('id', req.params.id)
            .maybeSingle();

        if (quizError) {
            console.error(quizError);
            return error(res, 'Database error', 500);
        }

        if (!quiz || quiz.status !== 'open') {
            return error(res, 'Quiz unavailable', 404);
        }

        const now = Date.now();

        if (quiz.starts_at && now < Date.parse(quiz.starts_at)) {
            return error(res, 'Quiz has not started', 400);
        }

        if (quiz.ends_at && now > Date.parse(quiz.ends_at)) {
            return error(res, 'Quiz has ended', 400);
        }

        // Check previous submission
        const { data: existing, error: existingError } = await supabase
            .from('quiz_submissions')
            .select('id')
            .eq('quiz_id', req.params.id)
            .eq('user_id', profile.id)
            .maybeSingle();

        if (existingError) {
            console.error(existingError);
            return error(res, 'Unable to check submission', 500);
        }

        if (existing) {
            return error(res, 'Already submitted', 409);
        }

        // Load questions and correct options
        const { data: questions, error: qError } = await supabase
            .from('quiz_questions')
            .select(`
                id,
                points,
                quiz_options (
                    id,
                    is_correct
                )
            `)
            .eq('quiz_id', req.params.id);

        if (qError) {
            console.error(qError);
            return error(res, 'Unable to load questions', 500);
        }

        if (!questions || questions.length === 0) {
            return error(res, 'Quiz has no questions', 400);
        }

        // Require one answer per question
        if (answers.length !== questions.length) {
            return error(
                res,
                'Please answer every question exactly once',
                400
            );
        }

        const answerMap = new Map();

        for (const answer of answers) {
            if (
                !answer ||
                typeof answer.question_id !== 'string' ||
                typeof answer.selected_option_id !== 'string' ||
                answerMap.has(answer.question_id)
            ) {
                return error(res, 'Invalid or duplicate answers', 400);
            }

            answerMap.set(
                answer.question_id,
                answer.selected_option_id
            );
        }

        const questionIds = new Set(questions.map(q => q.id));

        if ([...answerMap.keys()].some(id => !questionIds.has(id))) {
            return error(res, 'Invalid question ID', 400);
        }

        let score = 0;
        const answerRows = [];

        for (const question of questions) {
            const selectedId = answerMap.get(question.id);

            const selectedOption = question.quiz_options.find(
                option => option.id === selectedId
            );

            if (!selectedOption) {
                return error(
                    res,
                    'Selected option does not belong to question',
                    400
                );
            }

            const isCorrect = selectedOption.is_correct === true;
            const pointsEarned = isCorrect
                ? Number(question.points)
                : 0;

            score += pointsEarned;

            answerRows.push({
                question_id: question.id,
                selected_option_id: selectedId,
                is_correct: isCorrect,
                points_earned: pointsEarned
            });
        }

        // Create submission
        const { data: submission, error: submissionError } = await supabase
            .from('quiz_submissions')
            .insert({
                quiz_id: req.params.id,
                user_id: profile.id,
                score,
                status: 'submitted'
            })
            .select()
            .single();

        if (submissionError) {
            console.error(submissionError);
            return error(res, 'Unable to save submission', 500);
        }

        // Save answers
        const rows = answerRows.map(a => ({
            ...a,
            submission_id: submission.id
        }));

        const { error: answersError } = await supabase
            .from('quiz_answers')
            .insert(rows);

        if (answersError) {
            console.error(answersError);

            await supabase
                .from('quiz_submissions')
                .delete()
                .eq('id', submission.id);

            return error(res, 'Unable to save answers', 500);
        }

        // Award points to both tables
        if (score > 0) {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('points')
                .eq('id', req.user.id)
                .single();

            if (userError) {
                console.error(userError);
                return error(res, 'Unable to load user points', 500);
            }

            const newPoints = Number(user.points || 0) + score;

            const { error: userPointsError } = await supabase
                .from('users')
                .update({
                    points: newPoints,
                    updated_at: new Date().toISOString()
                })
                .eq('id', req.user.id);

            if (userPointsError) {
                console.error(userPointsError);
                return error(res, 'Unable to update user points', 500);
            }

            const { error: profilePointsError } = await supabase
                .from('profiles')
                .update({
                    points: newPoints,
                    updated_at: new Date().toISOString()
                })
                .eq('id', req.user.id);

            if (profilePointsError) {
                console.error(profilePointsError);
                return error(res, 'Unable to update profile points', 500);
            }
        }

        return created(res, {
            submission_id: submission.id,
            score,
            correct_count: answerRows.filter(a => a.is_correct).length
        }, 'Quiz submitted');

    } catch (err) {
        console.error(err);
        return error(res, 'Internal server error', 500);
    }
}


// ==============================
// EXPORT
// ==============================

module.exports = {
    listQuizzes,
    getQuiz,
    getQuestions,
    createQuiz,
    updateQuiz,
    deactivateQuiz,
    createQuestion,
    submitQuiz
};
