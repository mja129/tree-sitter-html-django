/**
 * @file HTML grammar for tree-sitter
 * @author Max Brunsfeld
 * @license MIT
 */

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'html',

  extras: $ => [
    $.comment,
    /\s+/,
  ],

  externals: $ => [
    $._start_tag_name,
    $._script_start_tag_name,
    $._style_start_tag_name,
    $._end_tag_name,
    $.erroneous_end_tag_name,
    '/>',
    $._implicit_end_tag,
    $.raw_text,
    $.comment,
  ],

  rules: {
    document: $ => repeat($._node),

    doctype: $ => seq(
      '<!',
      alias($._doctype, 'doctype'),
      /[^>]+/,
      '>',
    ),

    _doctype: _ => /[Dd][Oo][Cc][Tt][Yy][Pp][Ee]/,

    _node: $ => choice(
      $.doctype,
      $.entity,
      $.text,
      $.element,
      $.script_element,
      $.style_element,
      $.erroneous_end_tag,
    ),

    element: $ => choice(
      seq(
        $.start_tag,
        repeat($._node),
        choice($.end_tag, $._implicit_end_tag),
      ),
      $.self_closing_tag,
    ),

    script_element: $ => seq(
      alias($.script_start_tag, $.start_tag),
      optional($.raw_text),
      $.end_tag,
    ),

    style_element: $ => seq(
      alias($.style_start_tag, $.start_tag),
      optional($.raw_text),
      $.end_tag,
    ),

    start_tag: $ => seq(
      '<',
      alias($._start_tag_name, $.tag_name),
      repeat($.attribute),
      '>',
    ),

    script_start_tag: $ => seq(
      '<',
      alias($._script_start_tag_name, $.tag_name),
      repeat($.attribute),
      '>',
    ),

    style_start_tag: $ => seq(
      '<',
      alias($._style_start_tag_name, $.tag_name),
      repeat($.attribute),
      '>',
    ),

    self_closing_tag: $ => seq(
      '<',
      alias($._start_tag_name, $.tag_name),
      repeat($.attribute),
      '/>',
    ),

    end_tag: $ => seq(
      '</',
      alias($._end_tag_name, $.tag_name),
      '>',
    ),

    erroneous_end_tag: $ => seq(
      '</',
      $.erroneous_end_tag_name,
      '>',
    ),

    attribute: $ => seq(
      $.attribute_name,
      optional(seq(
        '=',
        choice(
          $.attribute_value,
          $.quoted_attribute_value,
        ),
      )),
    ),

    attribute_name: _ => /[^<>"'/=\s]+/,

    attribute_value: _ => /[^<>"'=\s]+/,

    // An entity can be named, numeric (decimal), or numeric (hexacecimal). The
    // longest entity name is 29 characters long, and the HTML spec says that
    // no more will ever be added.
    entity: _ => /&(#([xX][0-9a-fA-F]{1,6}|[0-9]{1,5})|[A-Za-z]{1,30});?/,

    quoted_attribute_value: $ => choice(
      seq('\'', optional(alias(/[^']+/, $.attribute_value)), '\''),
      seq('"', optional(alias(/[^"]+/, $.attribute_value)), '"'),
    ),

    text: $ => choice($.djangonode, /[^<>&{%\s]([^<>&{%]*[^<>&{%\s])?/),

    djangonode: $ => choice(
      $._expression,
      $._statement,
      $._comment
    ),

    // General rules
    keyword: $ => token(seq(
      choice(
        "on",
        "off",
        "with",
        "as",
        "silent",
        "only",
        "from",
        "random",
        "by"
      ),
      /\s/
    )),
    keyword_operator: $ => token(seq(
      choice(
        "and",
        "or",
        "not",
        "in",
        "not in",
        "is",
        "is not"
      ),
      /\s/
    )),
    operator: $ => choice("==", "!=", "<", ">", "<=", ">="),
    number: $ => /[0-9]+/,
    boolean: $ => token(seq(choice("True", "False"), /\s/)),
    string: $ => seq(
      choice(
        seq("'", repeat(/[^']/), "'"),
        seq('"', repeat(/[^"]/), '"')
      ),
      repeat(seq("|", $.filter))
    ),

    _identifier: $ => /\w+/,

    // Expressions
    _expression: $ => seq("{{", $.variable, "}}"),

    variable: $ => seq($.variable_name, repeat(seq("|", $.filter))),
    // Django variables cannot start with an "_", can contain one or more words separated by a "."
    variable_name: $ => /[a-zA-Z](\w+)?((\.?\w)+)?/,

    filter: $ => seq($.filter_name, optional(seq(":", choice($.filter_argument, $._quoted_filter_argument)))),
    filter_name: $ => $._identifier,
    filter_argument: $ => seq($._identifier, repeat(seq(".", $._identifier))),
    _quoted_filter_argument: $ => choice(
      seq("'", alias(repeat(/[^']/), $.filter_argument), "'"),
      seq('"', alias(repeat(/[^"]/), $.filter_argument), '"')
    ),

    // Statements
    // unpaired type {% tag %}
    // paired type   {% tag %}..{% endtag %}
    _statement: $ => choice(
      $.paired_statement,
      alias($.if_statement, $.paired_statement),
      alias($.for_statement, $.paired_statement),
      alias($.filter_statement, $.paired_statement),
      $.unpaired_statement
    ),

    paired_statement: $ => {
      const tag_names = [
        "autoescape",
        "block",
        "blocktranslate",
        "ifchanged",
        "spaceless",
        "verbatim",
        "with"
      ];

      return choice(...tag_names.map((tag_name) => seq(
        "{%", alias(tag_name, $.tag_name), repeat($._attribute), "%}",
        repeat($._node),
        "{%", alias("end" + tag_name, $.tag_name), repeat($._attribute), alias("%}", $.end_paired_statement))));
    },

    if_statement: $ => seq(
      "{%", alias("if", $.tag_name), repeat($._attribute), "%}",
      repeat($._node),
      repeat(prec.left(seq(
        alias($.elif_statement, $.branch_statement),
        repeat($._node),
      ))),
      optional(seq(
        alias($.else_statement, $.branch_statement),
        repeat($._node),
      )),
      "{%", alias("endif", $.tag_name), alias("%}", $.end_paired_statement)
    ),
    elif_statement: $ => seq("{%", alias("elif", $.tag_name), repeat($._attribute), "%}"),
    else_statement: $ => seq("{%", alias("else", $.tag_name), "%}"),

    for_statement: $ => seq(
      "{%", alias("for", $.tag_name), repeat($._attribute), "%}",
      repeat($._node),
      optional(seq(
        alias($.empty_statement, $.branch_statement),
        repeat($._node),
      )),
      "{%", alias("endfor", $.tag_name), alias("%}", $.end_paired_statement)
    ),
    empty_statement: $ => seq("{%", alias("empty", $.tag_name), repeat($._attribute), "%}"),

    filter_statement: $ => seq(
      "{%", alias("filter", $.tag_name), $.filter, repeat(seq("|", $.filter)), "%}",
      repeat($._node),
      "{%", alias("endfilter", $.tag_name), alias("%}", $.end_paired_statement)
    ),
    unpaired_statement: $ => seq("{%", alias($._identifier, $.tag_name), repeat($._attribute), "%}"),

    _attribute: $ => seq(
      choice(
        $.keyword,
        $.operator,
        $.keyword_operator,
        $.number,
        $.boolean,
        $.string,
        $.variable
      ),
      optional(choice(",", "="))
    ),

    // Comments
    // unpaired type {# comment #}
    // paired type   {% comment optional_label %}..{% endcomment %}
    _comment: $ => choice(
      $.unpaired_comment,
      $.paired_comment
    ),
    unpaired_comment: $ => seq("{#", repeat(/.|\s/), repeat(seq(alias($.unpaired_comment, ""), repeat(/.|\s/))), "#}"),
    paired_comment: $ => seq(
      alias("{%", ""), "comment", optional($._identifier), alias("%}", ""),
      repeat(/.|\s/),
      repeat(seq(alias($.paired_comment, ""), repeat(/.|\s/))),
      alias("{%", ""), "endcomment", alias("%}", "")
    ),
  },
});
