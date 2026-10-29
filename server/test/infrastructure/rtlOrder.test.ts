import { describe, expect, it } from 'vitest';
import { lineDirection, logicalOrder, pageDirection, type Direction } from '../../src/infrastructure/readers/rtlOrder';
import type { RawChar } from '../../src/infrastructure/readers/stextBlocks';

/**
 * Characters exactly as mupdf 1.28 returned them for Arabic text printed to PDF by Edge in Arial:
 * "hex@x0-x1/bidi" per character, in mupdf's order.
 */
function mupdfLine(dump: string): RawChar[] {
  return dump.split(' ').map((token) => {
    const [hex, rest] = token.split('@') as [string, string];
    const [range, bidi] = rest.split('/') as [string, string];
    const [x0, x1] = range.split('-').map(Number) as [number, number];
    return { c: String.fromCodePoint(parseInt(hex, 16)), x0, x1, rtl: Number(bidi) % 2 === 1 };
  });
}

function read(dump: string, direction: Direction = 'rtl'): string {
  return logicalOrder(mupdfLine(dump), direction)
    .map((char) => char.c)
    .join('');
}

describe('logicalOrder on glyph clusters', () => {
  it('puts lam-alef back in order', () => {
    expect(read('627@590.005-590.005/3 644@583.477-590.005/1')).toBe('لا');
  });

  it('fixes lam-alef inside words and keeps the rest of the line', () => {
    const line =
      '627@587.531-590.015/3 644@585.047-587.531/3 633@578.675-585.047/3 627@578.674-578.674/3 644@571.463-578.674/3 ' +
      '645@567.407-571.463/3 20@564.071-567.407/3 639@557.759-564.071/3 644@555.275-557.759/3 64a@552.347-555.275/3 ' +
      '643@547.619-552.347/3 645@543.563-547.619/1';
    expect(read(line)).toBe('السلام عليكم');
  });

  it('puts the four letters of the rial ligature back in order', () => {
    expect(read('644@589.996-589.996/1 627@589.996-589.996/1 64a@589.996-589.996/3 631@575.344-589.996/1')).toBe('ريال');
  });

  it('puts a diacritic after its letter without taking the next letter', () => {
    const line =
      '64e@586.213-586.213/1 645@586.213-586.213/3 62f@581.232-585.276/3 631@575.364-581.232/3 633@568.992-575.364/3 629@564.492-568.992/1';
    expect(read(line)).toBe('مَدرسة');
  });

  it('leaves left-to-right text alone', () => {
    const latin = mupdfLine('41@10-16/0 2d@16-20/0 31@20-26/0');
    expect(logicalOrder(latin, 'ltr')).toEqual(latin);
    expect(logicalOrder(latin, 'rtl')).toEqual(latin);
  });
});

describe('logicalOrder on the spaces mupdf adds', () => {
  it('drops the space mupdf adds inside a word before a letter with a diacritic', () => {
    // "صباحًا" from the sample meeting minutes: mupdf fills the width of حً with a space of its own.
    const line =
      '635@345.329-355.346/3 628@341.990-345.329/3 627@339.485-341.985/3 20@334.819-339.485/3 64b@334.819-334.819/1 ' +
      '62d@334.819-334.819/3 627@331.138-333.637/3';
    expect(read(line)).toBe('صباحًا');
  });

  it('keeps the real space before a word that starts with a letter with a diacritic', () => {
    // "لم تُسجَّل" from the same minutes.
    const line =
      '644@525.928-529.267/3 645@520.084-525.923/3 20@517.346-520.085/3 64f@515.003-515.003/1 62a@515.003-515.003/3 ' +
      '633@505.659-514.007/3 20@500.992-505.659/3 651@500.992-500.992/1 64e@500.992-500.992/1 62c@500.992-500.992/3 ' +
      '644@493.138-499.816/3';
    expect(read(line).normalize('NFC')).toBe('لم تُسجَّل'.normalize('NFC'));
  });

  it('keeps the real space before lam-alef, whose zero-width part sits where the space starts', () => {
    expect(read('645@595-600/3 20@590.005-595/3 627@590.005-590.005/3 644@583.477-590.005/1')).toBe('م لا');
  });
});

describe('logicalOrder on mixed right-to-left lines', () => {
  it('puts a number before the Arabic word that follows it', () => {
    const line =
      '20@566.640-569.976/3 644@566.640-566.640/1 627@566.640-566.640/1 64a@566.640-566.640/3 631@551.988-566.640/1 ' +
      '35@569.977-576.649/0 30@576.649-583.321/0 30@583.321-589.993/0';
    expect(read(line)).toBe('500 ريال');
  });

  it('orders three runs from right to left', () => {
    const line =
      '20@542.788-546.124/3 644@542.788-542.788/1 627@542.788-542.788/1 64a@542.788-542.788/3 631@528.136-542.788/3 ' +
      '20@524.800-528.136/3 633@518.428-524.800/3 639@513.700-518.428/3 648@508.516-513.700/3 62f@504.472-508.516/3 ' +
      '64a@496.816-504.472/1 35@546.129-552.801/0 30@552.801-559.473/0 30@559.473-566.145/0 20@566.156-569.492/0 ' +
      '627@587.516-590.000/3 644@585.032-587.516/3 645@580.304-585.032/3 628@577.376-580.304/3 644@574.892-577.376/3 ' +
      '63a@569.492-574.892/1';
    expect(read(line)).toBe('المبلغ 500 ريال سعودي');
  });

  it('orders Latin words on a right-to-left line too', () => {
    const line =
      '35@523.301-529.973/0 30@529.973-536.645/0 30@536.645-543.317/0 20@543.328-546.664/0 20@561.316-564.652/3 ' +
      '644@561.316-561.316/1 627@561.316-561.316/1 64a@561.316-561.316/3 631@546.664-561.316/1 54@564.656-571.988/0 ' +
      '6f@570.656-577.328/0 74@577.328-580.664/0 61@580.664-587.336/0 6c@587.336-590.000/0';
    expect(read(line)).toBe('Total ريال 500');
  });

  it('keeps runs that already read from right to left', () => {
    const line = mupdfLine('627@40-44/1 644@36-40/1 20@33-36/1 31@20-26/0 32@26-32/0');
    expect(logicalOrder(line, 'rtl').map((char) => char.c).join('')).toBe('ال 12');
  });

  it('turns a number in Arabic-Indic digits back to left-to-right order', () => {
    // "٤١٢٬٣٠٠ ساعة" from the sample meeting minutes; mupdf lists the digits from right to left.
    const line =
      '660@202.325-206.494/1 660@198.156-202.325/1 663@193.148-198.986/1 66c@190.644-193.143/1 662@185.635-190.644/1 ' +
      '661@183.131-185.630/1 664@178.957-183.126/1 20@176.208-178.947/1 633@167.860-176.208/1 627@165.356-167.855/1 ' +
      '639@159.508-165.357/1 629@154.499-159.508/1';
    expect(read(line)).toBe('٤١٢٬٣٠٠ ساعة');
    expect(read(line, 'ltr')).toBe('٤١٢٬٣٠٠ ساعة');
  });

  it('keeps the two halves of a time in order', () => {
    // "١٢:٣٠" from the same minutes.
    const line = '660@277.001-281.170/1 663@271.993-277.831/1 3a@269.825-271.995/1 662@264.817-269.826/1 661@262.313-264.812/1';
    expect(read(line)).toBe('١٢:٣٠');
  });

  it('keeps a percent sign and full stop after the number, with no space before them', () => {
    // "التأسيس ٧٠٪." from the same minutes; mupdf lists ".٪" first, left to right.
    const line =
      '2e@150.293-152.462/0 66a@152.460-158.309/0 660@163.317-167.486/3 667@158.309-164.147/1 20@167.496-170.235/0 ' +
      '627@202.790-205.289/3 644@199.451-202.790/3 62a@196.112-199.451/3 623@193.608-196.107/3 633@185.260-193.608/3 ' +
      '64a@181.921-185.260/3 633@170.235-181.922/1';
    expect(read(line)).toBe('التأسيس ٧٠٪.');
  });

  it('keeps Arabic-Indic digits that are already left to right', () => {
    expect(read('661@10-14/1 66b@14-16/1 665@16-20/1')).toBe('١٫٥');
  });

  it('keeps run order on a left-to-right line', () => {
    const line = mupdfLine('54@10-16/0 6f@16-22/0 20@22-25/0 644@30-34/1 627@26-30/1');
    expect(logicalOrder(line, 'ltr').map((char) => char.c).join('')).toBe('To لا');
  });
});

describe('pageDirection and lineDirection', () => {
  it('follows the script with more letters on the page', () => {
    expect(pageDirection('عقد المشروع Project')).toBe('rtl');
    expect(pageDirection('Contract for the project عقد')).toBe('ltr');
    expect(pageDirection('1,250,000')).toBe('ltr');
  });

  it('uses the line when one script clearly leads and the page otherwise', () => {
    expect(lineDirection('قيمة العقد 1,250,000', 'ltr')).toBe('rtl');
    expect(lineDirection('Contract value 1,250,000', 'rtl')).toBe('ltr');
    expect(lineDirection('Total ريال 500', 'rtl')).toBe('rtl');
    expect(lineDirection('Total ريال 500', 'ltr')).toBe('ltr');
    expect(lineDirection('1,250,000', 'rtl')).toBe('rtl');
  });
});
