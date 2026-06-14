import parsePublicCombatsHtml from './parsePublicCombats';

describe('parsePublicCombatsHtml', () => {
  it('detects planetary combats from planétaire type text', () => {
    const html = `
      <table>
        <tr><td colspan="5">Secteur 1</td></tr>
        <tr>
          <td>Empire A</td>
          <td>Empire B</td>
          <td>planétaire</td>
          <td>10 vaisseaux</td>
          <td><i>Alpha</i></td>
        </tr>
      </table>
    `;

    const combats = parsePublicCombatsHtml(html);
    expect(combats).toHaveLength(1);
    expect(combats[0].kind).toBe('planetary');
    expect(combats[0].systemName).toBe('Alpha');
    expect(combats[0].summary).toContain('Type: planétaire');
  });

  it('ignores spatial combats because exact location is not available', () => {
    const html = `
      <table>
        <tr><td colspan="5">Secteur 2</td></tr>
        <tr>
          <td>Empire C</td>
          <td>Empire D</td>
          <td>spatial</td>
          <td>5 vaisseaux</td>
          <td>Beta</td>
        </tr>
      </table>
    `;

    const combats = parsePublicCombatsHtml(html);
    expect(combats).toHaveLength(0);
  });
});
