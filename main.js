(function() {
    'use strict';

    const LOG_LEVELS = {
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('vercel.app');

    const logger = {
        log(level, message, data = null) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level,
                message,
                url: window.location.href,
                userAgent: navigator.userAgent.substring(0, 100)
            };

            if (data) {
                logEntry.data = this.sanitizeData(data);
            }

            if (isDevelopment || level === LOG_LEVELS.ERROR) {
                const consoleMethod = level === LOG_LEVELS.ERROR ? 'error' : 
                                     level === LOG_LEVELS.WARN ? 'warn' : 'log';
                console[consoleMethod](`[${level}] ${message}`, data || '');
            }

            if (!isDevelopment && level === LOG_LEVELS.ERROR) {
                this.sendToLogEndpoint(logEntry);
            }
        },

        info(message, data = null) {
            this.log(LOG_LEVELS.INFO, message, data);
        },

        warn(message, data = null) {
            this.log(LOG_LEVELS.WARN, message, data);
        },

        error(message, data = null) {
            this.log(LOG_LEVELS.ERROR, message, data);
        },

        debug(message, data = null) {
            if (isDevelopment) {
                this.log(LOG_LEVELS.DEBUG, message, data);
            }
        },

        sanitizeData(data) {
            if (!data) return null;
            
            const sensitiveFields = ['password', 'token', 'cpf', 'creditCard', 'cvv'];
            const sanitized = { ...data };
            
            for (const field of sensitiveFields) {
                if (sanitized[field]) {
                    sanitized[field] = '[REDACTED]';
                }
            }
            
            return sanitized;
        },

        sendToLogEndpoint(logEntry) {
            try {
                const blob = new Blob([JSON.stringify(logEntry)], { type: 'application/json' });
                navigator.sendBeacon('/api/logs', blob);
            } catch (err) {
                console.error('Falha ao enviar log:', err);
            }
        }
    };

    class RateLimiter {
        constructor(maxRequests = 3, timeWindowMs = 60000) {
            this.maxRequests = maxRequests;
            this.timeWindowMs = timeWindowMs;
            this.requests = [];
        }

        canMakeRequest() {
            const now = Date.now();
            this.requests = this.requests.filter(timestamp => now - timestamp < this.timeWindowMs);
            
            if (this.requests.length < this.maxRequests) {
                this.requests.push(now);
                return true;
            }
            
            const oldestRequest = this.requests[0];
            const timeToWait = this.timeWindowMs - (now - oldestRequest);
            logger.warn(`Rate limit atingido. Próxima requisição em ${Math.ceil(timeToWait / 1000)} segundos`);
            return false;
        }

        getRemainingRequests() {
            const now = Date.now();
            this.requests = this.requests.filter(timestamp => now - timestamp < this.timeWindowMs);
            return Math.max(0, this.maxRequests - this.requests.length);
        }
    }

    const validators = {
        nome(value) {
            const sanitized = value.trim().replace(/[<>]/g, '');
            if (sanitized.length < 3) {
                return { valid: false, message: 'Nome deve ter pelo menos 3 caracteres' };
            }
            if (sanitized.length > 100) {
                return { valid: false, message: 'Nome não pode exceder 100 caracteres' };
            }
            if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(sanitized)) {
                return { valid: false, message: 'Nome deve conter apenas letras e espaços' };
            }
            return { valid: true, value: sanitized };
        },

        email(value) {
            const sanitized = value.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
            if (!emailRegex.test(sanitized)) {
                return { valid: false, message: 'Informe um e-mail válido' };
            }
            if (sanitized.length > 255) {
                return { valid: false, message: 'E-mail muito longo' };
            }
            return { valid: true, value: sanitized };
        },

        telefone(value) {
            const sanitized = value.replace(/\D/g, '');
            if (sanitized.length < 10 || sanitized.length > 11) {
                return { valid: false, message: 'Telefone deve ter 10 ou 11 dígitos' };
            }
            return { valid: true, value: sanitized };
        },

        mensagem(value) {
            const sanitized = value.trim().replace(/[<>]/g, '');
            if (sanitized.length > 2000) {
                return { valid: false, message: 'Mensagem não pode exceder 2000 caracteres' };
            }
            return { valid: true, value: sanitized };
        },

        interesse(value) {
            if (!value || value === '') {
                return { valid: false, message: 'Selecione uma opção' };
            }
            return { valid: true, value: value };
        }
    };

    class FormHandler {
        constructor(formId, rateLimiter) {
            this.form = document.getElementById(formId);
            this.rateLimiter = rateLimiter;
            this.submitCount = 0;
            this.statusElement = document.getElementById('mensagemStatus');
            this.init();
        }

        init() {
            if (!this.form) {
                logger.error('Formulário não encontrado', { formId: this.form?.id });
                return;
            }

            this.form.addEventListener('submit', this.handleSubmit.bind(this));
            logger.info('Formulário inicializado', { formId: this.form.id });
        }

        validateForm(formData) {
            const errors = {};
            let isValid = true;

            for (const [field, value] of formData.entries()) {
                if (validators[field]) {
                    const result = validators[field](value);
                    if (!result.valid) {
                        errors[field] = result.message;
                        isValid = false;
                    } else {
                        formData.set(field, result.value);
                    }
                }
            }

            return { isValid, errors };
        }

        showValidationErrors(errors) {
            for (const [field, message] of Object.entries(errors)) {
                const input = document.getElementById(field);
                if (input) {
                    input.classList.add('is-invalid');
                    let feedback = input.nextElementSibling;
                    if (feedback && feedback.classList.contains('invalid-feedback')) {
                        feedback.textContent = message;
                    }
                }
            }
        }

        clearValidation() {
            const inputs = this.form.querySelectorAll('.form-control');
            inputs.forEach(input => {
                input.classList.remove('is-invalid');
                input.classList.remove('is-valid');
            });
        }

        showStatus(message, type = 'info') {
            if (!this.statusElement) return;

            const alertClass = type === 'error' ? 'alert-danger' : 
                              type === 'success' ? 'alert-success' : 'alert-info';
            
            this.statusElement.innerHTML = `
                <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                    ${this.sanitizeHtml(message)}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
                </div>
            `;

            const alertElement = this.statusElement.querySelector('.alert');
            if (alertElement) {
                setTimeout(() => {
                    alertElement.classList.remove('show');
                    setTimeout(() => {
                        if (this.statusElement && this.statusElement.innerHTML.includes(alertClass)) {
                            this.statusElement.innerHTML = '';
                        }
                    }, 200);
                }, 5000);
            }
        }

        sanitizeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        async handleSubmit(event) {
            event.preventDefault();
            
            logger.info('Tentativa de submissão', { formId: this.form.id, attempt: this.submitCount + 1 });

            if (!this.rateLimiter.canMakeRequest()) {
                const remaining = this.rateLimiter.getRemainingRequests();
                this.showStatus(
                    `Limite de tentativas excedido. Aguarde antes de tentar novamente.`,
                    'error'
                );
                logger.warn('Rate limit excedido');
                return;
            }

            const formData = new FormData(this.form);
            const { isValid, errors } = this.validateForm(formData);
            this.clearValidation();
            
            if (!isValid) {
                this.showValidationErrors(errors);
                this.showStatus('Por favor, corrija os erros no formulário antes de continuar.', 'error');
                logger.warn('Validação falhou', { errors });
                return;
            }

            const submitButton = this.form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton?.innerHTML;
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Enviando...';
            }

            this.submitCount++;

            try {
                const formObject = Object.fromEntries(formData.entries());
                logger.info('Enviando dados', { fields: Object.keys(formObject) });
                
                await this.simulateApiCall(formObject);
                
                this.showStatus('Solicitação enviada com sucesso! Entraremos em contato em breve para agendar sua visita.', 'success');
                this.form.reset();
                
                logger.info('Formulário enviado com sucesso');
                
            } catch (error) {
                this.showStatus('Erro ao enviar solicitação. Por favor, tente novamente mais tarde.', 'error');
                logger.error('Erro no envio', { error: error.message });
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                }
            }
        }

        async simulateApiCall(data) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (Math.random() > 0.05) {
                        resolve({ success: true, message: 'Solicitação recebida' });
                    } else {
                        reject(new Error('Erro simulado na API'));
                    }
                }, 1200);
            });
        }
    }


    class GoldenGrains {
        constructor() {
            this.container = document.getElementById('grainsContainer');
            if (this.container) {
                this.createGrains(40);
                logger.debug('GoldenGrains inicializado');
            }
        }

        createGrains(count) {
            for (let i = 0; i < count; i++) {
                const grain = document.createElement('div');
                grain.className = 'grain';
                
                const left = Math.random() * 100;
                const duration = 5 + Math.random() * 8;
                const delay = Math.random() * 10;
                const size = 8 + Math.random() * 10;
                
                grain.style.left = `${left}%`;
                grain.style.bottom = `-${Math.random() * 20}px`;
                grain.style.height = `${size}px`;
                grain.style.width = `${size * 0.25}px`;
                grain.style.animationDuration = `${duration}s`;
                grain.style.animationDelay = `${delay}s`;
                grain.style.opacity = 0.3 + Math.random() * 0.5;
                
                this.container.appendChild(grain);
            }
        }
    }


    class ScrollAnimations {
        constructor() {
            this.elements = document.querySelectorAll('.animate-on-scroll');
            this.init();
        }

        init() {
            this.checkVisibility();
            window.addEventListener('scroll', this.checkVisibility.bind(this));
            window.addEventListener('resize', this.checkVisibility.bind(this));
            logger.debug('ScrollAnimations inicializado');
        }

        checkVisibility() {
            const windowHeight = window.innerHeight;
            const triggerPoint = 100;

            this.elements.forEach(element => {
                const elementTop = element.getBoundingClientRect().top;
                
                if (elementTop < windowHeight - triggerPoint) {
                    const animationClass = element.dataset.animation || 'fade-in-up';
                    if (!element.classList.contains(animationClass)) {
                        element.classList.add(animationClass);
                    }
                }
            });
        }
    }


    class ScrollProgress {
        constructor() {
            this.progressBar = document.querySelector('.scroll-progress');
            if (this.progressBar) {
                this.init();
            }
        }

        init() {
            window.addEventListener('scroll', this.update.bind(this));
            logger.debug('ScrollProgress inicializado');
        }

        update() {
            const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (window.scrollY / windowHeight) * 100;
            this.progressBar.style.width = scrolled + '%';
        }
    }

    class LeafDecoration {
        constructor() {
            this.createLeaf();
        }

        createLeaf() {
            if (document.querySelector('.leaf-decoration')) return;
            
            const leaf = document.createElement('div');
            leaf.className = 'leaf-decoration';
            leaf.innerHTML = `
                <svg width="55" height="55" viewBox="0 0 24 24" fill="none" stroke="#C4A747" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2C8 6 4 10 4 14c0 4 4 6 8 6s8-2 8-6c0-4-4-8-8-12z"/>
                    <path d="M12 8v8"/>
                    <path d="M8 12h8"/>
                </svg>
            `;
            document.body.appendChild(leaf);
        }
    }

    class CardReveal {
        constructor() {
            this.cards = document.querySelectorAll('.card');
            this.init();
        }

        init() {
            if (this.cards.length === 0) return;

            this.cards.forEach((card, index) => {
                card.classList.add('animate-on-scroll');
                card.dataset.animation = 'scale-in';
                const delay = Math.min(index * 80, 400);
                card.style.animationDelay = `${delay}ms`;
            });
            
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('scale-in');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15 });
            
            this.cards.forEach(card => observer.observe(card));
            
            logger.debug('CardReveal inicializado', { totalCards: this.cards.length });
        }
    }

    class NavbarHandler {
        constructor() {
            this.navbar = document.querySelector('.navbar');
            this.init();
        }

        init() {
            if (!this.navbar) return;
            
            window.addEventListener('scroll', this.handleScroll.bind(this));
            this.handleScroll();
            logger.debug('NavbarHandler inicializado');
        }

        handleScroll() {
            if (window.scrollY > 50) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
        }
    }

    class CarouselHandler {
        constructor() {
            this.carouselElement = document.getElementById('carouselPrincipal');
            if (this.carouselElement) {
                this.carousel = new bootstrap.Carousel(this.carouselElement, {
                    interval: 5000,
                    wrap: true,
                    pause: 'hover'
                });
                this.attachEventListeners();
                logger.info('Carousel inicializado');
            }
        }

        attachEventListeners() {
            this.carouselElement.addEventListener('slid.bs.carousel', (event) => {
                logger.debug('Carousel slide alterado', {
                    from: event.from,
                    to: event.to
                });
            });
        }
    }

    window.addEventListener('error', (event) => {
        logger.error('Erro global não tratado', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Promise rejection não tratada', {
            reason: event.reason?.message || event.reason
        });
    });

    document.addEventListener('DOMContentLoaded', () => {
        logger.info('Haras Herança - Aplicação inicializada', {
            url: window.location.href,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString()
        });

        const rateLimiter = new RateLimiter(3, 60000);
        
        new FormHandler('formContato', rateLimiter);
        new NavbarHandler();
        new CarouselHandler();
        new ScrollAnimations();
        new ScrollProgress();
        new LeafDecoration();
        new CardReveal();
        new GoldenGrains();

        const titles = document.querySelectorAll('.section-title');
        titles.forEach((title, index) => {
            title.classList.add('animate-on-scroll');
            title.dataset.animation = 'fade-in-up';
            title.style.animationDelay = `${index * 100}ms`;
        });

        const leads = document.querySelectorAll('.lead');
        leads.forEach((lead, index) => {
            lead.classList.add('animate-on-scroll');
            lead.dataset.animation = 'fade-in-up';
            lead.style.animationDelay = `${index * 80 + 200}ms`;
        });

        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.setAttribute('autocomplete', 'off');
        });

        logger.info('Todos os módulos inicializados com sucesso');
    });
})();
