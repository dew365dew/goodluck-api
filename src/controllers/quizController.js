const supabase = require('../config/supabase');
const { success, created, error } = require('../core/response');


// GET /api/quizzes
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
            console.error('List quizzes error:', dbError);
            return error(res, 'Unable to load quizzes', 500);
        }

        return success(res, data, 'Quizzes loaded');

    } catch (err) {
        console.error('List quizzes exception:', err);
        return error(res, 'Internal server error', 500);
    }
}



// GET /api/quizzes/:id
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
            console.error('Get quiz error:', dbError);
            return error(res, 'Database error', 500);
        }

        if (!data) {
            return error(res, 'Quiz not found', 404);
        }

        return success(res, data, 'Quiz loaded');

    } catch (err) {
        console.error('Get quiz exception:', err);
        return error(res, 'Internal server error', 500);
    }
}


// GET /api/quizzes/:id/questions
async function getQuestions(req, res) {
    const { data, error: dbError } = await supabase
        .from('quiz_questions')
        .select(`
            id,
            question_text,
            points,
            sort_order,
            quiz_options (
                id,
                option_text
            )
        `)
        .eq('quiz_id', req.params.id)
        .order('sort_order', { ascending: true });

    if (dbError) return error(res, 'Unable to load questions', 500);

    return success(res, data, 'Questions loaded');
}

// POST /api/quizzes (Admin)
async function createQuiz(req, res) {
    const {
        title,
        description = null,
        starts_at = null,
        ends_at = null
    } = req.body;

    if (!title || !String(title).trim()) {
        return error(res, 'Title is required', 400);
    }

    const { data, error: dbError } = await supabase
        .from('quizzes')
        .insert({
            title: String(title).trim(),
            description,
            starts_at,
            ends_at,
            is_active: false,
            created_by: req.user.id
        })
        .select()
        .single();

    if (dbError) return error(res, 'Unable to create quiz', 500);

    return created(res, data, 'Quiz created');
}

// PATCH /api/quizzes/:id (Admin)
async function updateQuiz(req, res) {
    const allowed = [
        'title',
        'description',
        'is_active',
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

    updates.updated_at = new Date().toISOString();

    const { data, error: dbError } = await supabase
        .from('quizzes')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .maybeSingle();

    if (dbError) return error(res, 'Unable to update quiz', 500);
    if (!data) return error(res, 'Quiz not found', 404);

    return success(res, data, 'Quiz updated');
}

// DELETE /api/quizzes/:id (Admin)
// ปิดใช้งานแทนการลบข้อมูล
async function deactivateQuiz(req, res) {
    const { data, error: dbError } = await supabase
        .from('quizzes')
        .update({
            is_active: false,
            updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .select()
        .maybeSingle();

    if (dbError) return error(res, 'Unable to deactivate quiz', 500);
    if (!data) return error(res, 'Quiz not found', 404);

    return success(res, data, 'Quiz deactivated');
}

// POST /api/quizzes/:id/questions (Admin)
async function createQuestion(req, res) {
    const {
        question_text,
        points = 1,
        sort_order = 0,
        options
    } = req.body;

    if (!question_text || !Array.isArray(options) || options.length < 2) {
        return error(res, 'Question and at least two options are required', 400);
    }

    if (options.filter(o => o.is_correct === true).length !== 1) {
        return error(res, 'Exactly one option must be correct', 400);
    }

    if (!Number.isInteger(Number(points)) || Number(points) < 0) {
        return error(res, 'Invalid points', 400);
    }

    const { data: quiz } = await supabase
        .from('quizzes')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle();

    if (!quiz) return error(res, 'Quiz not found', 404);

    const { data: question, error: qError } = await supabase
        .from('quiz_questions')
        .insert({
            quiz_id: req.params.id,
            question_text,
            points: Number(points),
            sort_order: Number(sort_order) || 0
        })
        .select()
        .single();

    if (qError) return error(res, 'Unable to create question', 500);

    const optionRows = options.map(o => ({
        question_id: question.id,
        option_text: String(o.option_text || '').trim(),
        is_correct: o.is_correct === true
    }));

    if (optionRows.some(o => !o.option_text)) {
        await supabase.from('quiz_questions').delete().eq('id', question.id);
        return error(res, 'Every option needs option_text', 400);
    }

    const { data: savedOptions, error: oError } = await supabase
        .from('quiz_options')
        .insert(optionRows)
        .select('id,option_text');

    if (oError) {
        await supabase.from('quiz_questions').delete().eq('id', question.id);
        return error(res, 'Unable to create options', 500);
    }

    return created(res, {
        ...question,
        options: savedOptions
    }, 'Question created');
}

// POST /api/quizzes/:id/submit
async function submitQuiz(req, res) {
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
        return error(res, 'Answers are required', 400);
    }

    const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('id,is_active,starts_at,ends_at')
        .eq('id', req.params.id)
        .maybeSingle();

    if (quizError) return error(res, 'Database error', 500);
    if (!quiz || !quiz.is_active) return error(res, 'Quiz unavailable', 404);

    const now = Date.now();

    if (quiz.starts_at && now < Date.parse(quiz.starts_at)) {
        return error(res, 'Quiz has not started', 400);
    }

    if (quiz.ends_at && now > Date.parse(quiz.ends_at)) {
        return error(res, 'Quiz has ended', 400);
    }

    const { data: existing } = await supabase
        .from('quiz_submissions')
        .select('id')
        .eq('quiz_id', req.params.id)
        .eq('user_id', req.user.id)
        .maybeSingle();

    if (existing) {
        return error(res, 'Already submitted', 409);
    }

    const { data: questions, error: qError } = await supabase
        .from('quiz_questions')
        .select('id,points,quiz_options(id,is_correct)')
        .eq('quiz_id', req.params.id);

    if (qError) return error(res, 'Unable to load questions', 500);
    if (!questions || questions.length === 0) {
        return error(res, 'Quiz has no questions', 400);
    }

    const answerMap = new Map(
        answers.map(a => [a.question_id, a.option_id])
    );

    if (answerMap.size !== answers.length) {
        return error(res, 'Duplicate answers', 400);
    }

    const questionIds = new Set(questions.map(q => q.id));

    for (const answer of answers) {
        if (!questionIds.has(answer.question_id)) {
            return error(res, 'Invalid question ID', 400);
        }
    }

    let score = 0;
    let maxScore = 0;

    const answerRows = [];

    for (const question of questions) {
        maxScore += question.points;

        const selectedId = answerMap.get(question.id);

        const selectedOption = question.quiz_options.find(
            option => option.id === selectedId
        );

        const correct = Boolean(
            selectedOption && selectedOption.is_correct
        );

        const awarded = correct ? question.points : 0;

        score += awarded;

        answerRows.push({
            question_id: question.id,
            option_id: selectedId || null,
            is_correct: correct,
            points_awarded: awarded
        });
    }

    const { data: submission, error: sError } = await supabase
        .from('quiz_submissions')
        .insert({
            quiz_id: req.params.id,
            user_id: req.user.id,
            score,
            max_score: maxScore
        })
        .select()
        .single();

    if (sError) return error(res, 'Already submitted or unable to save', 409);

    const rows = answerRows.map(a => ({
        ...a,
        submission_id: submission.id
    }));

    const { error: aError } = await supabase
        .from('quiz_answers')
        .insert(rows);

    if (aError) {
        await supabase
            .from('quiz_submissions')
            .delete()
            .eq('id', submission.id);

        return error(res, 'Unable to save answers', 500);
    }

    if (score > 0) {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('points')
            .eq('id', req.user.id)
            .single();

        if (userError) {
            return error(res, 'Unable to load user points', 500);
        }

        const { error: pointsError } = await supabase
            .from('users')
            .update({
                points: Number(user.points || 0) + score,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.id);

        if (pointsError) {
            return error(res, 'Unable to award points', 500);
        }
    }

    return created(res, {
        submission_id: submission.id,
        score,
        max_score: maxScore,
        correct_count: answerRows.filter(a => a.is_correct).length
    }, 'Quiz submitted');
}

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