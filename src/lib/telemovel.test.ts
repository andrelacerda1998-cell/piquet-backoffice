import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * Guardas do que o backoffice tem de continuar a fazer no telemóvel.
 *
 * São verificações estruturais, lidas do código: não substituem olhar para o
 * ecrã, mas impedem que as decisões abaixo se percam sem ninguém dar por isso
 * — todas elas foram problemas reais num telemóvel de 375px.
 */

const ler = (f: string) => readFileSync(f, "utf8");

describe("tabelas", () => {
  const dataTable = ler("src/components/ui/DataTable.tsx");

  it("tem uma versão em cartões para ecrãs pequenos", () => {
    // Num ecrã de 375px viam-se duas das oito colunas, e ler uma linha
    // obrigava a arrastar para o lado várias vezes.
    expect(dataTable).toContain('className="md:hidden space-y-2"');
  });

  it("a tabela só aparece quando há largura para ela", () => {
    expect(dataTable).toMatch(/card overflow-hidden hidden md:block/);
  });

  it("o cartão do telemóvel mostra todas as colunas visíveis", () => {
    // Esconder colunas no telemóvel seria esconder dados sem o dizer.
    const bloco = dataTable.slice(dataTable.indexOf('className="md:hidden'), dataTable.indexOf("hidden md:block"));
    expect(bloco).toContain("visibleColumns");
  });
});

describe("menu do telemóvel", () => {
  const sidebar = ler("src/components/layout/Sidebar.tsx");

  it("abre sempre expandido, mesmo com a barra recolhida no computador", () => {
    // Partilhavam o mesmo estado: com a barra recolhida no portátil, o menu do
    // telemóvel abria como uma tira de ícones sem texto.
    expect(sidebar).toContain("sidebarContent(false)");
  });

  it("a versão do computador continua a respeitar o estado recolhido", () => {
    expect(sidebar).toContain("sidebarContent(sidebarCollapsed)");
  });
});

describe("filas de filtros", () => {
  it("a classe .chip-row corre na horizontal no telemóvel e quebra a partir de sm", () => {
    const css = ler("src/app/globals.css");
    const bloco = css.slice(css.indexOf(".chip-row {"), css.indexOf(".input-field"));
    expect(bloco).toContain("overflow-x-auto");
    expect(bloco).toContain("sm:flex-wrap");
  });
});

describe("atalhos de teclado", () => {
  it("o ⌘K não é sugerido a quem está no telemóvel", () => {
    // Não há teclado: era uma indicação impossível de seguir.
    const banner = ler("src/components/ui/WelcomeBanner.tsx");
    const botao = banner.slice(banner.indexOf("setCommandOpen(true)"), banner.indexOf("Percebi, dispensar"));
    expect(botao).toContain("hidden sm:inline-flex");
  });
});
