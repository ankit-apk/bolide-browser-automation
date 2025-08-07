// Form Intelligence System - Smart form field detection and filling
// Handles complex forms with precision

(function() {
    console.log('📝 Form Intelligence System initialized');
    
    // Field type patterns for detection
    const FIELD_PATTERNS = {
        email: {
            attributes: ['email', 'e-mail', 'mail'],
            types: ['email'],
            patterns: [/email/i, /mail/i, /e-mail/i],
            validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        },
        username: {
            attributes: ['username', 'user', 'login', 'userid', 'user-id', 'user_name'],
            types: ['text'],
            patterns: [/user/i, /login/i, /account/i],
            excludePatterns: [/email/i, /pass/i, /name/i]
        },
        password: {
            attributes: ['password', 'pass', 'pwd', 'passwd'],
            types: ['password'],
            patterns: [/pass/i, /pwd/i],
            excludePatterns: [/confirm/i, /retype/i, /repeat/i]
        },
        confirmPassword: {
            attributes: ['confirm', 'retype', 'repeat', 'verify'],
            types: ['password'],
            patterns: [/confirm/i, /retype/i, /repeat/i, /verify/i]
        },
        firstName: {
            attributes: ['firstname', 'first-name', 'first_name', 'fname', 'givenname'],
            types: ['text'],
            patterns: [/first/i, /given/i, /fname/i]
        },
        lastName: {
            attributes: ['lastname', 'last-name', 'last_name', 'lname', 'surname', 'familyname'],
            types: ['text'],
            patterns: [/last/i, /surname/i, /family/i, /lname/i]
        },
        fullName: {
            attributes: ['name', 'fullname', 'full-name', 'full_name', 'displayname'],
            types: ['text'],
            patterns: [/^name$/i, /fullname/i, /your name/i],
            excludePatterns: [/user/i, /first/i, /last/i, /company/i, /business/i]
        },
        phone: {
            attributes: ['phone', 'tel', 'telephone', 'mobile', 'cell', 'contact'],
            types: ['tel', 'phone'],
            patterns: [/phone/i, /mobile/i, /cell/i, /tel/i]
        },
        address: {
            attributes: ['address', 'street', 'addr', 'location'],
            types: ['text'],
            patterns: [/address/i, /street/i, /location/i]
        },
        city: {
            attributes: ['city', 'town', 'locality'],
            types: ['text'],
            patterns: [/city/i, /town/i, /locality/i]
        },
        country: {
            attributes: ['country', 'nation'],
            types: ['text', 'select'],
            patterns: [/country/i, /nation/i]
        },
        zipcode: {
            attributes: ['zip', 'zipcode', 'postal', 'postcode', 'pincode'],
            types: ['text'],
            patterns: [/zip/i, /postal/i, /post/i, /pin/i]
        },
        company: {
            attributes: ['company', 'organization', 'org', 'business'],
            types: ['text'],
            patterns: [/company/i, /organization/i, /business/i]
        },
        search: {
            attributes: ['search', 'query', 'q', 'keyword'],
            types: ['search', 'text'],
            patterns: [/search/i, /query/i, /find/i]
        }
    };
    
    // Analyze a form and return field mapping
    function analyzeForm(formElement) {
        const fields = [];
        const inputs = formElement.querySelectorAll('input, textarea, select');
        
        for (const input of inputs) {
            if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
                continue;
            }
            
            const fieldInfo = identifyField(input);
            fields.push({
                element: input,
                type: fieldInfo.type,
                confidence: fieldInfo.confidence,
                rect: input.getBoundingClientRect(),
                visible: isVisible(input),
                required: input.required || input.getAttribute('aria-required') === 'true',
                label: getFieldLabel(input)
            });
        }
        
        // Sort by visual position (top to bottom, left to right)
        fields.sort((a, b) => {
            if (Math.abs(a.rect.top - b.rect.top) > 10) {
                return a.rect.top - b.rect.top;
            }
            return a.rect.left - b.rect.left;
        });
        
        return fields;
    }
    
    // Identify field type with confidence score
    function identifyField(input) {
        let bestMatch = { type: 'unknown', confidence: 0 };
        
        // Check each field pattern
        for (const [fieldType, pattern] of Object.entries(FIELD_PATTERNS)) {
            let score = 0;
            
            // Check input type
            if (pattern.types && pattern.types.includes(input.type)) {
                score += 30;
            }
            
            // Check attributes (name, id, placeholder, etc.)
            const attributes = [
                input.name,
                input.id,
                input.placeholder,
                input.getAttribute('aria-label'),
                input.getAttribute('data-field'),
                input.className
            ].filter(Boolean).join(' ').toLowerCase();
            
            // Check for pattern matches
            for (const attr of pattern.attributes) {
                if (attributes.includes(attr)) {
                    score += 40;
                    break;
                }
            }
            
            // Check regex patterns
            if (pattern.patterns) {
                for (const regex of pattern.patterns) {
                    if (regex.test(attributes)) {
                        score += 20;
                        break;
                    }
                }
            }
            
            // Check exclude patterns (negative matches)
            if (pattern.excludePatterns) {
                for (const regex of pattern.excludePatterns) {
                    if (regex.test(attributes)) {
                        score -= 30;
                        break;
                    }
                }
            }
            
            // Check label text
            const label = getFieldLabel(input);
            if (label) {
                const labelLower = label.toLowerCase();
                for (const attr of pattern.attributes) {
                    if (labelLower.includes(attr)) {
                        score += 30;
                        break;
                    }
                }
                
                if (pattern.patterns) {
                    for (const regex of pattern.patterns) {
                        if (regex.test(labelLower)) {
                            score += 20;
                            break;
                        }
                    }
                }
            }
            
            // Update best match
            if (score > bestMatch.confidence) {
                bestMatch = { type: fieldType, confidence: score };
            }
        }
        
        // If confidence is too low, try contextual analysis
        if (bestMatch.confidence < 30) {
            bestMatch = analyzeFieldContext(input);
        }
        
        return bestMatch;
    }
    
    // Analyze field based on context
    function analyzeFieldContext(input) {
        const form = input.closest('form');
        if (!form) return { type: 'unknown', confidence: 0 };
        
        const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"])'));
        const index = inputs.indexOf(input);
        
        // Common patterns
        if (inputs.length === 2) {
            // Login form pattern
            if (inputs[0].type === 'text' && inputs[1].type === 'password') {
                return index === 0 ? 
                    { type: 'username', confidence: 70 } : 
                    { type: 'password', confidence: 70 };
            }
        }
        
        // Registration form pattern
        if (inputs.length >= 3) {
            // Check position in form
            if (index === 0 && input.type === 'text') {
                return { type: 'fullName', confidence: 50 };
            }
            if (input.type === 'email') {
                return { type: 'email', confidence: 80 };
            }
            if (input.type === 'password') {
                const passwordInputs = inputs.filter(i => i.type === 'password');
                if (passwordInputs.length > 1) {
                    return passwordInputs.indexOf(input) === 0 ?
                        { type: 'password', confidence: 70 } :
                        { type: 'confirmPassword', confidence: 70 };
                }
                return { type: 'password', confidence: 70 };
            }
        }
        
        return { type: 'unknown', confidence: 0 };
    }
    
    // Get label for a field
    function getFieldLabel(input) {
        // Check for associated label
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.textContent.trim();
        }
        
        // Check for parent label
        const parentLabel = input.closest('label');
        if (parentLabel) {
            return parentLabel.textContent.replace(input.value || '', '').trim();
        }
        
        // Check for nearby text
        const parent = input.parentElement;
        if (parent) {
            // Check previous sibling
            let sibling = input.previousElementSibling;
            if (sibling && (sibling.tagName === 'LABEL' || sibling.tagName === 'SPAN')) {
                return sibling.textContent.trim();
            }
            
            // Check parent's text
            const parentText = Array.from(parent.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join(' ');
            if (parentText) return parentText;
        }
        
        return '';
    }
    
    // Smart form filling
    async function fillForm(formData) {
        console.log('Filling form with data:', formData);
        
        // Find all forms on page
        const forms = document.querySelectorAll('form');
        let targetForm = null;
        let bestScore = 0;
        
        // Find best matching form
        for (const form of forms) {
            if (!isVisible(form)) continue;
            
            const fields = analyzeForm(form);
            let score = 0;
            
            // Score based on matching fields
            for (const fieldName of Object.keys(formData)) {
                if (fields.find(f => f.type === fieldName)) {
                    score++;
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                targetForm = form;
            }
        }
        
        if (!targetForm) {
            console.error('No suitable form found');
            return { success: false, error: 'No form found' };
        }
        
        // Analyze and fill the form
        const fields = analyzeForm(targetForm);
        const filledFields = [];
        
        for (const field of fields) {
            if (!field.visible) continue;
            
            const value = formData[field.type];
            if (value !== undefined) {
                const success = await fillField(field.element, value);
                if (success) {
                    filledFields.push({
                        type: field.type,
                        label: field.label,
                        value: value
                    });
                    
                    // Add delay between fields for natural behavior
                    await sleep(200 + Math.random() * 300);
                }
            }
        }
        
        return {
            success: true,
            filledFields: filledFields,
            form: targetForm
        };
    }
    
    // Fill a single field with proper events
    async function fillField(element, value) {
        try {
            // Focus the field
            element.focus();
            element.click();
            
            // Clear existing value
            element.select();
            element.value = '';
            
            // For select elements
            if (element.tagName === 'SELECT') {
                // Find matching option
                const options = Array.from(element.options);
                const match = options.find(opt => 
                    opt.value.toLowerCase() === value.toLowerCase() ||
                    opt.text.toLowerCase() === value.toLowerCase()
                );
                
                if (match) {
                    element.value = match.value;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }
            
            // For input/textarea elements - use direct assignment
            element.value = value;
            
            // Trigger all necessary events
            const events = [
                new Event('input', { bubbles: true }),
                new Event('change', { bubbles: true }),
                new KeyboardEvent('keyup', { bubbles: true })
            ];
            
            for (const event of events) {
                element.dispatchEvent(event);
            }
            
            // Validate if needed
            if (element.checkValidity) {
                element.checkValidity();
            }
            
            console.log(`✅ Filled ${element.name || element.id} with "${value}"`);
            return true;
            
        } catch (error) {
            console.error('Failed to fill field:', error);
            return false;
        }
    }
    
    // Find specific field by type
    function findFieldByType(fieldType) {
        const allInputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
        let bestMatch = null;
        let bestScore = 0;
        
        for (const input of allInputs) {
            if (!isVisible(input)) continue;
            
            const fieldInfo = identifyField(input);
            if (fieldInfo.type === fieldType && fieldInfo.confidence > bestScore) {
                bestMatch = input;
                bestScore = fieldInfo.confidence;
            }
        }
        
        return bestMatch;
    }
    
    // Helper functions
    function isVisible(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               rect.top < window.innerHeight &&
               rect.bottom > 0;
    }
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Export functions for use
    window.FormIntelligence = {
        analyzeForm,
        identifyField,
        fillForm,
        findFieldByType,
        fillField,
        getFieldLabel
    };
    
    console.log('✅ Form Intelligence ready');
})();