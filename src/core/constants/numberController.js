const supabase = require('../config/supabase');
const { success, created, error } = require('../core/response');

// GET /api/numbers/rounds
async function listRounds(req, res) {
    const { data, error: dbError } = await supabase
        .from('number_rounds')
        .select('*')
        .in('status', ['open', 'closed', 'completed'])
        .order('created_at', { ascending: false });

    if (dbError) return error(res, 'Unable to load rounds', 500);

    return success(res, data, 'Rounds loaded');
}

// GET /api/numbers/rounds/:id
async function getRound(req, res) {
    const { data, error: dbError } = await supabase
        .from('number_rounds')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

    if (dbError) return error(res, 'Database error', 500);
    if (!data) return error(res, 'Round not found', 404);

    return success(res, data, 'Round loaded');
}

// POST /api/numbers/rounds (Admin)
async function createRound(req, res) {
    const {
        title,
        description = null,
        number_length = 2,
        opens_at = null,
        closes_at = null,
        points_per_correct = 10
    } = req.body;

    if (!title || !String(title).trim()) {
        return error(res, 'Title is required', 400);
    }

    if (!Number.isInteger(Number(number_length)) ||
        number_length < 1 || number_length > 12) {
        return error(res, 'number_length must be 1-12', 400);
    }

    if (!Number.isInteger(Number(points_per_correct)) ||
        points_per_correct < 0) {
        return error(res, 'Invalid points_per_correct', 400);
    }

    const { data, error: dbError } = await supabase
        .from('number_rounds')
        .insert({
            title: String(title).trim(),
            description,
            number_length: Number(number_length),
            opens_at,
            closes_at,
            points_per_correct: Number(points_per_correct),
            status: 'draft',
            created_by: req.user.id
        })
        .select()
        .single();

    if (dbError) return error(res, 'Unable to create round', 500);

    return created(res, data, 'Round created');
}

// PATCH /api/numbers/rounds/:id (Admin)
async function updateRound(req, res) {
    const allowed = [
        'title',
        'description',
        'number_length',
        'opens_at',
        'closes_at',
        'points_per_correct',
        'status'
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

    if (updates.status &&
        !['draft', 'open', 'closed'].includes(updates.status)) {
        return error(res, 'Invalid status', 400);
    }

    if (updates.number_length !== undefined &&
        (!Number.isInteger(Number(updates.number_length)) ||
        updates.number_length < 1 || updates.number_length > 12)) {
        return error(res, 'Invalid number_length', 400);
    }

    if (updates.points_per_correct !== undefined &&
        (!Number.isInteger(Number(updates.points_per_correct)) ||
        updates.points_per_correct < 0)) {
        return error(res, 'Invalid points_per_correct', 400);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error: dbError } = await supabase
        .from('number_rounds')
        .update(updates)
        .eq('id', req.params.id)
        .neq('status', 'completed')
        .select()
        .maybeSingle();

    if (dbError) return error(res, 'Unable to update round', 500);
    if (!data) return error(res, 'Round not found or completed', 404);

    return success(res, data, 'Round updated');
}

// POST /api/numbers/rounds/:id/choose
async function chooseNumber(req, res) {
    const { selected_number } = req.body;

    if (typeof selected_number !== 'string' ||
        !/^[0-9]+$/.test(selected_number)) {
        return error(res, 'selected_number must be a digit string', 400);
    }

    const { data: round, error: rError } = await supabase
        .from('number_rounds')
        .select('id,number_length,status,opens_at,closes_at')
        .eq('id', req.params.id)
        .maybeSingle();

    if (rError) return error(res, 'Database error', 500);
    if (!round) return error(res, 'Round not found', 404);

    if (round.status !== 'open') {
        return error(res, 'Round is not open', 400);
    }

    const now = Date.now();

    if (round.opens_at && now < Date.parse(round.opens_at)) {
        return error(res, 'Round has not opened', 400);
    }

    if (round.closes_at && now > Date.parse(round.closes_at)) {
        return error(res, 'Round has closed', 400);
    }

    if (selected_number.length !== round.number_length) {
        return error(
            res,
            `Number must contain ${round.number_length} digits`,
            400
        );
    }

    const { data, error: dbError } = await supabase
        .from('user_number_choices')
        .insert({
            round_id: round.id,
            user_id: req.user.id,
            selected_number
        })
        .select('id,round_id,user_id,selected_number,created_at')
        .single();

    if (dbError) {
        if (dbError.code === '23505') {
            return error(res, 'Already selected a number', 409);
        }

        return error(res, 'Unable to save selection', 500);
    }

    return created(res, data, 'Number selected');
}

// POST /api/numbers/rounds/:id/result (Admin)
async function setResult(req, res) {
    const { winning_number } = req.body;

    if (typeof winning_number !== 'string') {
        return error(res, 'winning_number is required as a string', 400);
    }

    const { data, error: rpcError } = await supabase.rpc(
        'finalize_number_round',
        {
            p_round_id: req.params.id,
            p_winning_number: winning_number,
            p_admin_id: req.user.id
        }
    );

    if (rpcError) {
        console.error(rpcError);

        if (rpcError.message.includes('ROUND_NOT_FOUND')) {
            return error(res, 'Round not found', 404);
        }

        if (rpcError.message.includes('INVALID_WINNING_NUMBER')) {
            return error(res, 'Invalid winning number', 400);
        }

        if (rpcError.message.includes('RESULT_ALREADY_EXISTS')) {
            return error(res, 'Result already exists', 409);
        }

        return error(res, 'Unable to save result', 500);
    }

    return success(res, data, 'Result saved and points awarded');
}

// GET /api/numbers/history
async function getHistory(req, res) {
    const { data, error: dbError } = await supabase
        .from('user_number_choices')
        .select(`
            id,
            selected_number,
            points_awarded,
            created_at,
            number_rounds (
                id,
                title,
                status,
                number_length
            )
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

    if (dbError) return error(res, 'Unable to load history', 500);

    return success(res, data, 'History loaded');
}

module.exports = {
    listRounds,
    getRound,
    createRound,
    updateRound,
    chooseNumber,
    setResult,
    getHistory
};