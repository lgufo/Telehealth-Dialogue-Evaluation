// Medical Dialogue Evaluation System
let dialoguesData = [];
let currentIndex = 0;
let evaluationData = {};

// DOM Elements
const dialogueDisplay = document.getElementById('dialogue-display');
const labelsDisplay = document.getElementById('labels-display');
const notesTextarea = document.getElementById('notes');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const saveBtn = document.getElementById('save-btn');
const currentDialogueSpan = document.getElementById('current-dialogue');
const totalDialoguesSpan = document.getElementById('total-dialogues');
const progressBar = document.getElementById('progress');

// Load JSON data
async function loadDialogues() {
    try {
        const response = await fetch('./labeled_1_120_processed_cn_telehealth_2020.json');
        dialoguesData = await response.json();
        totalDialoguesSpan.textContent = dialoguesData.length;
        displayDialogue(currentIndex);
        updateProgress();
    } catch (error) {
        console.error('Error loading dialogues:', error);
        dialogueDisplay.innerHTML = '<p class="error">Error loading dialogue data. Please ensure the JSON file is in the correct location.</p>';
    }
}

// Display dialogue content
function displayDialogue(index) {
    if (!dialoguesData[index]) return;

    const item = dialoguesData[index];
    const dialogue = item.data_sample;
    currentDialogueSpan.textContent = `Dialogue ${index + 1}`;

    // Display dialogue content
    let dialogueHtml = `<div class="dialogue-info">
        <strong>Dialogue ID:</strong> ${dialogue.dialogue_id || 'N/A'}<br>
        <strong>File Name:</strong> ${dialogue.file_name || 'N/A'}<br>
        <strong>Doctor Faculty:</strong> ${dialogue.doctor_faculty || 'N/A'}
    </div>`;

    // Display patient description
    if (dialogue.patient_description) {
        dialogueHtml += '<div class="patient-description">';
        dialogueHtml += '<h4>Patient Description:</h4>';
        Object.entries(dialogue.patient_description).forEach(([key, value]) => {
            dialogueHtml += `<p><strong>${key}:</strong> ${value}</p>`;
        });
        dialogueHtml += '</div>';
    }

    if (dialogue.dialogue && Array.isArray(dialogue.dialogue)) {
        dialogueHtml += '<div class="conversation">';
        dialogueHtml += '<h4>Dialogue:</h4>';
        dialogue.dialogue.forEach((turn, i) => {
            if (turn.speaker === 'end') return; // Skip end markers
            const speaker = turn.speaker === '病人' ? 'patient' : 'doctor';
            const speakerLabel = turn.speaker === '病人' ? 'Patient' : 'Doctor';
            dialogueHtml += `
                <div class="dialogue-turn ${speaker}">
                    <div class="speaker-label">${speakerLabel}</div>
                    <div class="message">${turn.lines || 'No content'}</div>
                </div>
            `;
        });
        dialogueHtml += '</div>';
    }

    // Display diagnosis and suggestions if available
    if (dialogue.diagnosis_and_suggestions) {
        dialogueHtml += `<div class="diagnosis-section">
            <h4>Diagnosis and Suggestions:</h4>
            <p>${dialogue.diagnosis_and_suggestions}</p>
        </div>`;
    }

    dialogueDisplay.innerHTML = dialogueHtml;

    // Reset scroll positions to top
    dialogueDisplay.scrollTop = 0;
    labelsDisplay.scrollTop = 0;

    // Display labels
    displayLabels(dialogue);

    // Load saved notes
    loadNotes(index);

    // Load saved importance score
    const importanceSlider = document.getElementById('dialogue-importance');
    const importanceValue = document.getElementById('dialogue-importance_value');
    const savedImportance = getDialogueImportance();
    if (importanceSlider) {
        importanceSlider.value = savedImportance;
        if (importanceValue) {
            importanceValue.textContent = savedImportance;
        }
    }

    // Update navigation buttons
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === dialoguesData.length - 1;
}

// Display labels for evaluation
function displayLabels(dialogue) {
    const item = dialoguesData[currentIndex];
    const labels = item.description_labels || {};
    let labelsHtml = '';

    // Define all possible label types and their descriptions
    const labelTypes = {
        'hallucination': 'Hallucination (false perceptions)',
        'illusion': 'Illusion (misinterpretation of real stimuli)', 
        'delirium': 'Delirium (confusion and disorientation)',
        'extrapolation': 'Extrapolation (extending beyond available data)',
        'delusion': 'Delusion (fixed false beliefs)',
        'confabulation': 'Confabulation (fabricated or distorted memories)',
        'other': 'Other cognitive distortion'
    };

    // Filter labels to only show those with value > 0
    const activeLabels = Object.entries(labelTypes).filter(([labelType, _]) => {
        const labelValue = labels[labelType] || 0;
        return labelValue > 0;
    });

    if (activeLabels.length === 0) {
        labelsHtml = '<div class="no-labels">No active labels (all values are 0)</div>';
    } else {
        activeLabels.forEach(([labelType, description]) => {
            const labelValue = labels[labelType] || 0;
            const importance = labels[`${labelType}_importance`] || 0;
            const reason = labels[`${labelType}_reason`] || 'No reason provided';
            
            labelsHtml += `
                <div class="label-item">
                    <div class="label-header">
                        <h4>${description}</h4>
                        <span class="label-value positive">
                            Score: ${labelValue} (Importance: ${importance})
                        </span>
                    </div>
                    ${reason && reason !== '' ? `<div class="label-reason"><strong>Reason:</strong> ${reason}</div>` : ''}
                    <div class="evaluation-options">
                        <label>
                            <input type="radio" name="${labelType}" value="correct" 
                                   ${getEvaluation(labelType) === 'correct' ? 'checked' : ''}>
                            Correct
                        </label>
                        <label>
                            <input type="radio" name="${labelType}" value="incorrect" 
                                   ${getEvaluation(labelType) === 'incorrect' ? 'checked' : ''}>
                            Incorrect
                        </label>
                        <label>
                            <input type="radio" name="${labelType}" value="unsure" 
                                   ${getEvaluation(labelType) === 'unsure' ? 'checked' : ''}>
                            Unsure
                        </label>
                    </div>
                </div>
            `;
        });
    }

    labelsDisplay.innerHTML = labelsHtml;

    // Add event listeners for evaluation changes (but don't auto-save)
    // Remove the auto-save event listener
}

// Get current evaluation for a label
function getEvaluation(labelType) {
    const key = `${currentIndex}_${labelType}`;
    return evaluationData[key] || '';
}

// Get user's dialogue importance score
function getDialogueImportance() {
    const key = `${currentIndex}_dialogue_importance`;
    return evaluationData[key] || '0.5';
}

// Update importance display value (make it global for inline oninput)
window.updateImportanceDisplay = function(slider) {
    const valueDisplay = document.getElementById(slider.id + '_value');
    if (valueDisplay) {
        valueDisplay.textContent = slider.value;
    }
    
    // Also temporarily store the value (but don't save to localStorage yet)
    const tempKey = `${currentIndex}_dialogue_importance`;
    evaluationData[tempKey] = slider.value;
}

// Save evaluation data
function saveEvaluation() {
    // Collect current form data when save button is clicked
    const radioButtons = labelsDisplay.querySelectorAll('input[type="radio"]:checked');
    const dialogueImportanceSlider = document.getElementById('dialogue-importance');
    
    radioButtons.forEach(radio => {
        const labelType = radio.name;
        const value = radio.value;
        const key = `${currentIndex}_${labelType}`;
        evaluationData[key] = value;
    });

    // Save dialogue importance score
    if (dialogueImportanceSlider) {
        const importanceKey = `${currentIndex}_dialogue_importance`;
        evaluationData[importanceKey] = dialogueImportanceSlider.value;
    }

    // Save current notes
    const notesKey = `${currentIndex}_notes`;
    evaluationData[notesKey] = notesTextarea.value;

    // Store in localStorage only when save button is clicked
    localStorage.setItem('dialogueEvaluations', JSON.stringify(evaluationData));

    // Export to file
    exportEvaluations();
    
    // Show success message
    showSaveMessage();
}

// Load saved notes
function loadNotes(index) {
    const notesKey = `${index}_notes`;
    notesTextarea.value = evaluationData[notesKey] || '';
}

// Update progress bar
function updateProgress() {
    if (dialoguesData.length === 0) return;
    const progress = ((currentIndex + 1) / dialoguesData.length) * 100;
    progressBar.style.width = `${progress}%`;
}

// Navigation functions
function goToNext() {
    if (currentIndex < dialoguesData.length - 1) {
        currentIndex++;
        displayDialogue(currentIndex);
        updateProgress();
    }
}

function goToPrevious() {
    if (currentIndex > 0) {
        currentIndex--;
        displayDialogue(currentIndex);
        updateProgress();
    }
}

// Export evaluation data
function exportEvaluations() {
    // Create structured evaluation data
    const structuredData = {
        export_info: {
            timestamp: new Date().toISOString(),
            total_dialogues: dialoguesData.length,
            evaluated_dialogues: getEvaluatedDialogueCount()
        },
        evaluations: []
    };

    // Group evaluations by dialogue
    const dialogueEvaluations = {};
    Object.entries(evaluationData).forEach(([key, value]) => {
        const parts = key.split('_');
        const dialogueIndex = parseInt(parts[0]);
        const field = parts.slice(1).join('_');
        
        if (!dialogueEvaluations[dialogueIndex]) {
            dialogueEvaluations[dialogueIndex] = {
                dialogue_index: dialogueIndex,
                dialogue_id: dialoguesData[dialogueIndex]?.data_sample?.dialogue_id || null,
                evaluations: {},
                dialogue_importance_score: null,
                notes: ''
            };
        }
        
        if (field === 'notes') {
            dialogueEvaluations[dialogueIndex].notes = value;
        } else if (field === 'dialogue_importance') {
            dialogueEvaluations[dialogueIndex].dialogue_importance_score = parseFloat(value);
        } else {
            dialogueEvaluations[dialogueIndex].evaluations[field] = value;
        }
    });

    // Convert to array and sort by dialogue index
    structuredData.evaluations = Object.values(dialogueEvaluations)
        .sort((a, b) => a.dialogue_index - b.dialogue_index);

    const dataStr = JSON.stringify(structuredData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.download = `dialogue_evaluations_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Get count of evaluated dialogues
function getEvaluatedDialogueCount() {
    const evaluatedIndices = new Set();
    Object.keys(evaluationData).forEach(key => {
        const dialogueIndex = parseInt(key.split('_')[0]);
        evaluatedIndices.add(dialogueIndex);
    });
    return evaluatedIndices.size;
}

// Show save success message
function showSaveMessage() {
    // Create or update message element
    let messageEl = document.getElementById('save-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'save-message';
        messageEl.className = 'save-message';
        document.querySelector('.controls').appendChild(messageEl);
    }
    
    messageEl.textContent = `✓ Evaluation saved! File downloaded: dialogue_evaluations_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
    messageEl.style.display = 'block';
    
    // Hide message after 3 seconds
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
}

// Event listeners
nextBtn.addEventListener('click', goToNext);
prevBtn.addEventListener('click', goToPrevious);
saveBtn.addEventListener('click', saveEvaluation);
// Remove auto-save from notes textarea

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'Enter' && e.ctrlKey) saveEvaluation();
});

// Load saved evaluations from localStorage
function loadSavedEvaluations() {
    const saved = localStorage.getItem('dialogueEvaluations');
    if (saved) {
        evaluationData = JSON.parse(saved);
    }
}

// Initialize the application
function init() {
    loadSavedEvaluations();
    loadDialogues();
    
    // Add event listener for importance slider after DOM is ready
    setTimeout(() => {
        const importanceSlider = document.getElementById('dialogue-importance');
        if (importanceSlider) {
            importanceSlider.addEventListener('input', function() {
                window.updateImportanceDisplay(this);
            });
        }
    }, 100);
}

// Start the application
init();
