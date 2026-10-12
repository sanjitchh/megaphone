<?php

namespace App\Exceptions;

use App\Enums\JoinRefusal;
use RuntimeException;

/**
 * Thrown when a join, or the token behind it, is refused.
 */
class JoinRefusedException extends RuntimeException
{
    /**
     * Create the exception for the given reason.
     */
    public function __construct(public readonly JoinRefusal $reason)
    {
        parent::__construct("Join refused: {$reason->value}.");
    }
}
