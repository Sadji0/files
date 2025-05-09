document.addEventListener('DOMContentLoaded', () => {
    const addMetronomeBtn = document.getElementById('addMetronomeBtn');
    const metronomesContainer = document.getElementById('metronomesContainer');
    const metronomeTemplate = document.getElementById('metronomeTemplate');
    let metronomeIdCounter = 0;
    const activeMetronomes = {}; // To store instances and their intervals

    // --- Metronome Class (Conceptual - we manage state directly on DOM elements) ---
    // While a class could be used, for this example, we'll manage state associated
    // with each DOM element directly to keep it simpler.
    // A class `Metronome` would encapsulate `audioElement`, `intervalId`, `isPlaying`, etc.

    function createMetronome() {
        metronomeIdCounter++;
        const instanceId = `metronome-${metronomeIdCounter}`;

        const clone = metronomeTemplate.content.cloneNode(true);
        const metronomeDiv = clone.querySelector('.metronome-instance');
        metronomeDiv.id = instanceId;

        const title = metronomeDiv.querySelector('.metronome-title');
        title.textContent = `Metronome ${metronomeIdCounter}`;

        const soundFileInput = metronomeDiv.querySelector('.soundFile');
        const soundNameDisplay = metronomeDiv.querySelector('.soundName');
        const frequencyValueInput = metronomeDiv.querySelector('.frequencyValue');
        const frequencyUnitSelect = metronomeDiv.querySelector('.frequencyUnit');
        const toggleBtn = metronomeDiv.querySelector('.toggleBtn');
        const removeBtn = metronomeDiv.querySelector('.removeBtn');

        // Store state for this metronome instance
        activeMetronomes[instanceId] = {
            audioElement: new Audio(),
            intervalId: null,
            isPlaying: false,
            soundFileUrl: null // For revoking Object URL
        };

        soundFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const metronome = activeMetronomes[instanceId];
                if (metronome.soundFileUrl) {
                    URL.revokeObjectURL(metronome.soundFileUrl); // Revoke old URL
                }
                metronome.soundFileUrl = URL.createObjectURL(file);
                metronome.audioElement.src = metronome.soundFileUrl;
                soundNameDisplay.textContent = file.name;
                soundNameDisplay.title = file.name; // Show full name on hover
            } else {
                activeMetronomes[instanceId].audioElement.src = '';
                soundNameDisplay.textContent = 'No sound loaded';
                if (activeMetronomes[instanceId].soundFileUrl) {
                    URL.revokeObjectURL(activeMetronomes[instanceId].soundFileUrl);
                    activeMetronomes[instanceId].soundFileUrl = null;
                }
            }
        });

        toggleBtn.addEventListener('click', () => {
            const metronome = activeMetronomes[instanceId];
            if (metronome.isPlaying) {
                stopMetronome(instanceId, toggleBtn);
            } else {
                startMetronome(instanceId, toggleBtn, frequencyValueInput, frequencyUnitSelect);
            }
        });

        removeBtn.addEventListener('click', () => {
            removeMetronome(instanceId, metronomeDiv);
        });

        metronomesContainer.appendChild(clone);
    }

    function startMetronome(instanceId, button, freqInput, unitSelect) {
        const metronome = activeMetronomes[instanceId];
        if (!metronome.audioElement.src) {
            alert('Please load a sound file first!');
            return;
        }
        if (metronome.isPlaying) return;

        const freqValue = parseFloat(freqInput.value);
        const unit = unitSelect.value;
        let intervalMs;

        if (isNaN(freqValue) || freqValue <= 0) {
            alert('Please enter a valid positive frequency value.');
            return;
        }

        switch (unit) {
            case 'bpm': // Beats Per Minute
                intervalMs = (60 / freqValue) * 1000;
                break;
            case 's': // Seconds per beat
                intervalMs = freqValue * 1000;
                break;
            case 'ms': // Milliseconds per beat
                intervalMs = freqValue;
                break;
            case 'm': // Minutes per beat
                intervalMs = freqValue * 60 * 1000;
                break;
            default:
                alert('Invalid frequency unit.');
                return;
        }
        
        if (intervalMs <= 0) {
             alert('Calculated interval is too short or invalid. Please check frequency.');
             return;
        }


        function playSound() {
            metronome.audioElement.currentTime = 0; // Rewind to start
            metronome.audioElement.play().catch(error => {
                // Common error: User hasn't interacted with the page yet.
                // Or sound file is corrupted/unsupported.
                console.error(`Error playing sound for ${instanceId}:`, error);
                // Optionally stop the metronome if play fails persistently
                // stopMetronome(instanceId, button);
                // alert(`Could not play sound for ${instanceId}. Check console.`);
            });
        }

        // Play immediately once, then set interval
        playSound();
        metronome.intervalId = setInterval(playSound, intervalMs);
        metronome.isPlaying = true;
        button.textContent = 'Stop';
        button.classList.add('playing');
    }

    function stopMetronome(instanceId, button) {
        const metronome = activeMetronomes[instanceId];
        if (!metronome.isPlaying) return;

        clearInterval(metronome.intervalId);
        metronome.intervalId = null;
        metronome.isPlaying = false;
        if (button) { // Button might not exist if removed programmatically
            button.textContent = 'Start';
            button.classList.remove('playing');
        }
    }

    function removeMetronome(instanceId, elementToRemove) {
        const metronome = activeMetronomes[instanceId];
        if (metronome) {
            stopMetronome(instanceId); // Stop it if it's running
            if (metronome.soundFileUrl) {
                URL.revokeObjectURL(metronome.soundFileUrl); // Important for memory
            }
            delete activeMetronomes[instanceId];
        }
        elementToRemove.remove();
        // Optional: If you want to re-number or re-use IDs, you'd handle that here.
        // For simplicity, we just let IDs increment.
    }

    addMetronomeBtn.addEventListener('click', createMetronome);

    // Create one metronome by default on load
    createMetronome();
});