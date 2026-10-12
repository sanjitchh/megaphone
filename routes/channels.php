<?php

use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Raised hands and stage changes, for the room's host only.
Broadcast::channel('rooms.{room}.studio', function (User $user, Room $room) {
    return $room->host_id === $user->id;
});
