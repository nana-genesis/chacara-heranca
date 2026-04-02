## Sobre o Projeto:
Landing page institucional para venda de uma propriedade rural de alto padrão, desenvolvida como parte do curso EBAC - Profissão: Engenheiro Front-end.
O projeto apresenta uma propriedade rural completa com rio privado, estrutura para cavalos de raça, pastos manejados e infraestrutura de lazer, posicionada como um patrimônio familiar tradicional.

## Tecnologias Utilizadas
HTML5, estrutura semântica da página, CSS3, estilização personalizada e responsividade 
bootstrap 5, framework CSS para grid, carousel e componentes 
javaScript, validações, logs estruturados e rate limiting 
hospedagem em Vercel

## Funcionalidades Implementadas

### Carousel de Imagens
- Slider automático com 4 imagens da propriedade
- Transição suave com efeito fade
- Indicadores de navegação e controles manuais
- Legendas descritivas com informações da propriedade

### Grid Responsivo com Cards
- **Desktop**: 3 cards por linha
- **Tablet**: 2 cards por linha  
- **Smartphone**: 1 card por linha
- 6 cards com informações detalhadas:
  - Área total de 120 hectares
  - Haras completo com 32 baias
  - Sede histórica de 800m²
  - Infraestrutura de lazer
  - Pastos de alto padrão
  - Área de funcionários

### Segurança e Boas Práticas
- Sanitização de inputs contra XSS
- Rate limiting (3 tentativas por minuto no formulário)
- Logs estruturados com remoção de dados sensíveis
- Tratamento global de erros
- Headers de segurança configuráveis

### Acessibilidade
- Navegação por teclado
- Atributos ARIA
- Contraste adequado
- Suporte a leitores de tela
- Redução de movimento para usuários com sensibilidade
