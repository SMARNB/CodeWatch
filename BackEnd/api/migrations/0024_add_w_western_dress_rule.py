# Dress-code precise fix (model v3): the broad w-dress class was split into
#   w-dress[7]          = modest  -> compliant/female
#   w-western-dress[15] = western -> violation/female   (NEW class, emitted by dresscode_v3)
#
# This replaces the interim blunt fix (w-dress -> violation, which flagged ALL dresses incl.
# modest). FinalSystem maps model class name -> DB status automatically, so no engine logic
# changes — it picks up w-western-dress once a rule exists and the v3 weights are loaded.
#
# Forward applies the v3 policy. Reverse restores the v2/interim-compatible policy
# (w-dress -> violation, no w-western-dress) so rolling the model back to v2 stays consistent
# (see docs/DRESSCODE_PRECISE_FIX_HANDOFF.md section 6).

from django.db import migrations


def apply_v3_policy(apps, schema_editor):
    DressCodeRule = apps.get_model('api', 'DressCodeRule')
    DressCodeRule.objects.update_or_create(
        clothing_class='w-western-dress',
        defaults={'status': 'violation', 'gender': 'female'},
    )
    DressCodeRule.objects.update_or_create(
        clothing_class='w-dress',
        defaults={'status': 'compliant', 'gender': 'female'},
    )


def revert_to_v2_policy(apps, schema_editor):
    DressCodeRule = apps.get_model('api', 'DressCodeRule')
    DressCodeRule.objects.filter(clothing_class='w-western-dress').delete()
    DressCodeRule.objects.update_or_create(
        clothing_class='w-dress',
        defaults={'status': 'violation', 'gender': 'female'},
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_seed_dress_code_rules'),
    ]

    operations = [
        migrations.RunPython(apply_v3_policy, revert_to_v2_policy),
    ]
