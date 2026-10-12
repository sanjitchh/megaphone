<?php

use App\Http\Controllers\JoinController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomLinkController;
use App\Http\Controllers\RoomParticipantController;
use App\Http\Controllers\RoomStudioController;
use Illuminate\Support\Facades\Route;

// No public landing page: the host goes to their rooms (guests hit the login
// page), and attendees arrive through /r/{slug} links.
Route::redirect('/', '/rooms')->name('home');

Route::prefix('r/{link:slug}')->name('join.')->controller(JoinController::class)->group(function () {
    Route::middleware('throttle:join')->group(function () {
        Route::get('/', 'show')->name('show');
        Route::post('/', 'store')->name('store');
    });

    // Already joined: limited per browser session, not per IP, so a whole office behind
    // one address can sit in the same webinar.
    Route::middleware('throttle:participant')->group(function () {
        Route::get('live', 'room')->name('room');
        Route::post('hand', 'hand')->name('hand');
    });
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('rooms', RoomController::class)->except('show');

    Route::prefix('rooms/{room}')->name('rooms.')->controller(RoomStudioController::class)->group(function () {
        Route::get('studio', 'show')->name('studio');
        Route::post('live', 'goLive')->name('live');
        Route::post('end', 'end')->name('end');
    });

    Route::scopeBindings()->prefix('rooms/{room}/participants/{participant}')->name('rooms.participants.')->controller(RoomParticipantController::class)->group(function () {
        Route::post('promote', 'promote')->name('promote');
        Route::post('demote', 'demote')->name('demote');
        Route::post('lower-hand', 'lowerHand')->name('lower-hand');
        Route::post('remove', 'remove')->name('remove');
    });

    Route::scopeBindings()->prefix('rooms/{room}/links')->name('rooms.links.')->controller(RoomLinkController::class)->group(function () {
        Route::post('/', 'store')->name('store');
        Route::patch('{link}', 'update')->name('update');
        Route::post('{link}/revoke', 'revoke')->name('revoke');
        Route::post('{link}/regenerate', 'regenerate')->name('regenerate');
    });
});

require __DIR__.'/settings.php';
