<?php

use App\Http\Controllers\JoinController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomLinkController;
use App\Http\Controllers\RoomStudioController;
use Illuminate\Support\Facades\Route;

// No public landing page: the host goes to their rooms (guests hit the login
// page), and attendees arrive through /r/{slug} links.
Route::redirect('/', '/rooms')->name('home');

Route::get('r/{link:slug}', [JoinController::class, 'show'])
    ->middleware('throttle:join')
    ->name('join.show');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('rooms', RoomController::class)->except('show');

    Route::prefix('rooms/{room}')->name('rooms.')->controller(RoomStudioController::class)->group(function () {
        Route::get('studio', 'show')->name('studio');
        Route::post('live', 'goLive')->name('live');
        Route::post('end', 'end')->name('end');
    });

    Route::scopeBindings()->prefix('rooms/{room}/links')->name('rooms.links.')->controller(RoomLinkController::class)->group(function () {
        Route::post('/', 'store')->name('store');
        Route::patch('{link}', 'update')->name('update');
        Route::post('{link}/revoke', 'revoke')->name('revoke');
        Route::post('{link}/regenerate', 'regenerate')->name('regenerate');
    });
});

require __DIR__.'/settings.php';
